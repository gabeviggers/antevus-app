# Antevus Billing Implementation Guide

*Technical implementation for Stripe-based billing with hybrid pricing model*

## Executive Summary

This document provides a complete technical implementation for Antevus's billing system, supporting:
- **Self-serve checkout** for Core and Academic tiers
- **Sales-assisted contracts** for Team and Scale tiers
- **Enterprise agreements** with custom pricing
- **Usage-based metering** for events, AI tokens, and storage
- **Academic verification** and discount management
- **BYO-LLM** support across all tiers
- **Compliance Pack** and premium add-ons

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                      │
├────────────────────────────────────────────────────────────────┤
│  Pricing Page │ Billing Dashboard │ Usage Meters │ Admin Panel │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│                   API Layer (Next.js API Routes)               │
├────────────────────────────────────────────────────────────────┤
│ /api/billing/* │ /api/usage/* │ /api/subscriptions/* │ /webhooks
└────────────────┬───────────────────────────────────────────────┘
                 │
         ┌───────┴────────┬──────────────┬────────────┐
         ▼                ▼              ▼            ▼
┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐
│   Stripe    │  │  PostgreSQL  │  │  Redis   │  │  Kafka   │
│   Billing   │  │ Entitlements │  │  Cache   │  │  Events  │
└─────────────┘  └──────────────┘  └──────────┘  └──────────┘
```

## Phase 1: Core Infrastructure (Weeks 1-2)

### 1.1 Stripe Product Catalog Setup

#### Create Products in Stripe Dashboard

```javascript
// products.config.js
export const STRIPE_PRODUCTS = {
  // Subscription Tiers
  tiers: {
    core: {
      name: 'Core',
      priceId: process.env.STRIPE_CORE_PRICE_ID,
      price: 150000, // $1,500 in cents
      features: {
        instruments: 10,
        seats: 10,
        sites: 1,
        agents: 1,
        events: 1000000,
        aiTokens: 200000,
        storageGb: 1000
      }
    },
    team: {
      name: 'Team',
      priceId: process.env.STRIPE_TEAM_PRICE_ID,
      price: 400000,
      features: {
        instruments: 25,
        seats: 25,
        sites: 2,
        agents: 3,
        events: 3000000,
        aiTokens: 750000,
        storageGb: 3000
      }
    },
    scale: {
      name: 'Scale',
      priceId: process.env.STRIPE_SCALE_PRICE_ID,
      price: 750000,
      features: {
        instruments: 50,
        seats: 50,
        sites: 3,
        agents: 6,
        events: 8000000,
        aiTokens: 2000000,
        storageGb: 5000
      }
    }
  },

  // Academic Tiers (40% discount)
  academic: {
    core: {
      name: 'Core Academic',
      priceId: process.env.STRIPE_CORE_ACADEMIC_PRICE_ID,
      price: 90000, // $900
      features: 'same as core'
    },
    team: {
      name: 'Team Academic',
      priceId: process.env.STRIPE_TEAM_ACADEMIC_PRICE_ID,
      price: 240000,
      features: 'same as team'
    },
    scale: {
      name: 'Scale Academic',
      priceId: process.env.STRIPE_SCALE_ACADEMIC_PRICE_ID,
      price: 450000,
      features: 'same as scale'
    }
  },

  // Metered Products
  meters: {
    events: {
      name: 'Events',
      priceId: process.env.STRIPE_EVENTS_PRICE_ID,
      unit: 'event',
      tieredPricing: {
        core: { block: 250000, price: 10000 }, // $100 per 250k
        team: { block: 500000, price: 17500 }, // $175 per 500k
        scale: { block: 1000000, price: 30000 } // $300 per 1M
      }
    },
    aiTokens: {
      name: 'AI Tokens',
      priceId: process.env.STRIPE_AI_TOKENS_PRICE_ID,
      unit: '1000_tokens',
      margin: {
        core: 0.15,
        team: 0.10,
        scale: 0.08
      }
    },
    storage: {
      name: 'Storage',
      priceId: process.env.STRIPE_STORAGE_PRICE_ID,
      unit: 'gb_month',
      pricing: {
        core: 2000, // $20/TB
        team: 1500, // $15/TB
        scale: 1200 // $12/TB
      }
    }
  },

  // Add-ons
  addons: {
    compliancePack: {
      name: 'Compliance Pack',
      priceId: process.env.STRIPE_COMPLIANCE_PRICE_ID,
      price: 150000 // $1,500/month
    },
    premiumConnector: {
      name: 'Premium Connector',
      priceId: process.env.STRIPE_CONNECTOR_PRICE_ID,
      price: 50000 // $500/month
    },
    extraAgent: {
      name: 'Extra Edge Agent',
      priceId: process.env.STRIPE_EXTRA_AGENT_PRICE_ID,
      price: 10000 // $100/month
    },
    extraSite: {
      name: 'Extra Site',
      priceId: process.env.STRIPE_EXTRA_SITE_PRICE_ID,
      price: 30000 // $300/month
    },
    prioritySupport: {
      name: 'Priority Support',
      priceId: process.env.STRIPE_PRIORITY_SUPPORT_PRICE_ID,
      price: 100000 // $1,000/month
    }
  }
};
```

### 1.2 Database Schema

```sql
-- Organizations & Billing
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) UNIQUE,
  is_academic BOOLEAN DEFAULT false,
  academic_verified_at TIMESTAMP,
  academic_domain VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  tier VARCHAR(50) NOT NULL, -- core, team, scale, enterprise
  status VARCHAR(50) NOT NULL, -- active, past_due, canceled, trialing
  billing_period VARCHAR(20), -- monthly, annual
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  discount_percentage INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Entitlements
CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  subscription_id UUID REFERENCES subscriptions(id),
  resource_type VARCHAR(50), -- instruments, seats, sites, agents
  limit_value INTEGER NOT NULL,
  current_usage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, resource_type)
);

-- Usage Tracking
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  metric_type VARCHAR(50), -- events, ai_tokens, storage_gb
  value BIGINT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB DEFAULT '{}',
  stripe_usage_record_id VARCHAR(255),
  synced_to_stripe BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add-ons
CREATE TABLE subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  addon_type VARCHAR(50), -- compliance_pack, premium_connector, etc.
  stripe_subscription_item_id VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoices & Payments
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  stripe_invoice_id VARCHAR(255) UNIQUE,
  amount_due INTEGER,
  amount_paid INTEGER,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50),
  due_date TIMESTAMP,
  paid_at TIMESTAMP,
  payment_method VARCHAR(50), -- card, ach, wire
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contracts (for Enterprise)
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  contract_type VARCHAR(50), -- msa, order_form, dpa, baa
  document_url TEXT,
  signed_at TIMESTAMP,
  expires_at TIMESTAMP,
  annual_value INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Academic Verification
CREATE TABLE academic_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email_domain VARCHAR(255),
  institution_name VARCHAR(255),
  verification_method VARCHAR(50), -- auto, manual, sheerID
  verified_by UUID REFERENCES users(id),
  verification_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_usage_org_metric ON usage_records(organization_id, metric_type);
CREATE INDEX idx_usage_timestamp ON usage_records(timestamp);
CREATE INDEX idx_entitlements_org ON entitlements(organization_id);
```

### 1.3 Stripe Integration Service

```typescript
// lib/billing/stripe.service.ts
import Stripe from 'stripe';
import { STRIPE_PRODUCTS } from '@/config/products';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
  }

  // Create Customer
  async createCustomer(data: {
    email: string;
    name: string;
    organizationId: string;
    isAcademic?: boolean;
  }) {
    const customer = await this.stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: {
        organization_id: data.organizationId,
        is_academic: data.isAcademic ? 'true' : 'false',
      },
    });

    return customer;
  }

  // Create Checkout Session (Self-Serve)
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    tier: string;
    successUrl: string;
    cancelUrl: string;
    addons?: string[];
  }) {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: params.priceId,
        quantity: 1,
      },
    ];

    // Add any add-ons
    if (params.addons?.length) {
      params.addons.forEach(addon => {
        const addonProduct = STRIPE_PRODUCTS.addons[addon];
        if (addonProduct) {
          lineItems.push({
            price: addonProduct.priceId,
            quantity: 1,
          });
        }
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: params.customerId,
      line_items: lineItems,
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true,
      },
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      metadata: {
        tier: params.tier,
      },
      subscription_data: {
        metadata: {
          tier: params.tier,
        },
      },
    });

    return session;
  }

  // Create Invoice (Sales-Assisted)
  async createInvoice(params: {
    customerId: string;
    items: Array<{
      priceId: string;
      quantity: number;
      description?: string;
    }>;
    dueDate?: Date;
    paymentTerms?: 'net30' | 'net45' | 'net60';
  }) {
    // Create invoice items
    for (const item of params.items) {
      await this.stripe.invoiceItems.create({
        customer: params.customerId,
        price: item.priceId,
        quantity: item.quantity,
        description: item.description,
      });
    }

    // Create and finalize invoice
    const invoice = await this.stripe.invoices.create({
      customer: params.customerId,
      collection_method: 'send_invoice',
      days_until_due: this.getPaymentTermDays(params.paymentTerms),
      due_date: params.dueDate ? Math.floor(params.dueDate.getTime() / 1000) : undefined,
      auto_advance: true,
    });

    await this.stripe.invoices.finalizeInvoice(invoice.id);

    return invoice;
  }

  // Record Usage
  async recordUsage(params: {
    subscriptionItemId: string;
    quantity: number;
    timestamp?: number;
    action?: 'set' | 'increment';
  }) {
    const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
      params.subscriptionItemId,
      {
        quantity: params.quantity,
        timestamp: params.timestamp || Math.floor(Date.now() / 1000),
        action: params.action || 'increment',
      }
    );

    return usageRecord;
  }

  // Update Subscription
  async updateSubscription(params: {
    subscriptionId: string;
    items?: Array<{
      id?: string;
      price?: string;
      quantity?: number;
      deleted?: boolean;
    }>;
    metadata?: Record<string, string>;
    cancelAtPeriodEnd?: boolean;
  }) {
    const updateParams: Stripe.SubscriptionUpdateParams = {};

    if (params.items) {
      updateParams.items = params.items;
    }

    if (params.metadata) {
      updateParams.metadata = params.metadata;
    }

    if (params.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = params.cancelAtPeriodEnd;
    }

    const subscription = await this.stripe.subscriptions.update(
      params.subscriptionId,
      updateParams
    );

    return subscription;
  }

  // Apply Coupon
  async applyCoupon(customerId: string, couponId: string) {
    const customer = await this.stripe.customers.update(customerId, {
      coupon: couponId,
    });

    return customer;
  }

  private getPaymentTermDays(terms?: string): number {
    const termMap = {
      net30: 30,
      net45: 45,
      net60: 60,
    };

    return termMap[terms || 'net30'] || 30;
  }
}
```

## Phase 2: Entitlements & Metering (Weeks 3-4)

### 2.1 Entitlements Service

```typescript
// lib/billing/entitlements.service.ts
import { db } from '@/lib/db';
import { STRIPE_PRODUCTS } from '@/config/products';

export class EntitlementsService {
  // Check if resource usage is within limits
  async checkEntitlement(
    organizationId: string,
    resource: 'instruments' | 'seats' | 'sites' | 'agents',
    requestedQuantity: number = 1
  ): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    remaining: number;
  }> {
    const entitlement = await db.entitlements.findFirst({
      where: {
        organization_id: organizationId,
        resource_type: resource,
      },
    });

    if (!entitlement) {
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        remaining: 0,
      };
    }

    const remaining = entitlement.limit_value - entitlement.current_usage;
    const allowed = remaining >= requestedQuantity;

    return {
      allowed,
      currentUsage: entitlement.current_usage,
      limit: entitlement.limit_value,
      remaining,
    };
  }

  // Update usage
  async updateUsage(
    organizationId: string,
    resource: string,
    delta: number
  ): Promise<void> {
    await db.entitlements.update({
      where: {
        organization_id_resource_type: {
          organization_id: organizationId,
          resource_type: resource,
        },
      },
      data: {
        current_usage: {
          increment: delta,
        },
        updated_at: new Date(),
      },
    });
  }

  // Sync entitlements from subscription
  async syncFromSubscription(
    organizationId: string,
    tier: string,
    addons: string[] = []
  ): Promise<void> {
    const tierConfig = STRIPE_PRODUCTS.tiers[tier];
    if (!tierConfig) return;

    const features = tierConfig.features;

    // Update base entitlements
    const entitlements = [
      { resource: 'instruments', limit: features.instruments },
      { resource: 'seats', limit: features.seats },
      { resource: 'sites', limit: features.sites },
      { resource: 'agents', limit: features.agents },
    ];

    for (const entitlement of entitlements) {
      await db.entitlements.upsert({
        where: {
          organization_id_resource_type: {
            organization_id: organizationId,
            resource_type: entitlement.resource,
          },
        },
        update: {
          limit_value: entitlement.limit,
          updated_at: new Date(),
        },
        create: {
          organization_id: organizationId,
          resource_type: entitlement.resource,
          limit_value: entitlement.limit,
          current_usage: 0,
        },
      });
    }

    // Handle add-ons
    if (addons.includes('extraAgent')) {
      await db.query(`
        UPDATE entitlements
        SET limit_value = limit_value + 1
        WHERE organization_id = $1 AND resource_type = 'agents'
      `, [organizationId]);
    }

    if (addons.includes('extraSite')) {
      await db.query(`
        UPDATE entitlements
        SET limit_value = limit_value + 1
        WHERE organization_id = $1 AND resource_type = 'sites'
      `, [organizationId]);
    }
  }

  // Get all entitlements for organization
  async getEntitlements(organizationId: string) {
    const entitlements = await db.entitlements.findMany({
      where: {
        organization_id: organizationId,
      },
    });

    return entitlements.reduce((acc, ent) => {
      acc[ent.resource_type] = {
        limit: ent.limit_value,
        usage: ent.current_usage,
        remaining: ent.limit_value - ent.current_usage,
      };
      return acc;
    }, {});
  }
}
```

### 2.2 Usage Metering Service

```typescript
// lib/billing/metering.service.ts
import { db } from '@/lib/db';
import { StripeService } from './stripe.service';
import { KafkaProducer } from '@/lib/kafka';

export class MeteringService {
  private stripe: StripeService;
  private kafka: KafkaProducer;

  constructor() {
    this.stripe = new StripeService();
    this.kafka = new KafkaProducer();
  }

  // Track event
  async trackEvent(
    organizationId: string,
    eventType: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    // Send to Kafka for real-time processing
    await this.kafka.send('usage-events', {
      organizationId,
      type: 'event',
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        eventType,
      },
    });

    // Increment counter in Redis for real-time display
    await this.incrementRedisCounter(
      `usage:${organizationId}:events:${this.getCurrentPeriod()}`,
      1
    );
  }

  // Track AI tokens
  async trackAITokens(
    organizationId: string,
    tokens: number,
    model: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.kafka.send('usage-events', {
      organizationId,
      type: 'ai_tokens',
      value: tokens,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        model,
      },
    });

    await this.incrementRedisCounter(
      `usage:${organizationId}:ai_tokens:${this.getCurrentPeriod()}`,
      tokens
    );
  }

  // Track storage
  async trackStorage(
    organizationId: string,
    bytes: number,
    operation: 'add' | 'remove'
  ): Promise<void> {
    const delta = operation === 'add' ? bytes : -bytes;

    await this.kafka.send('usage-events', {
      organizationId,
      type: 'storage',
      value: delta,
      timestamp: new Date().toISOString(),
      metadata: {
        operation,
      },
    });

    await this.incrementRedisCounter(
      `usage:${organizationId}:storage:current`,
      delta
    );
  }

  // Aggregate and sync to Stripe (run hourly)
  async syncUsageToStripe(): Promise<void> {
    const organizations = await db.organizations.findMany({
      where: {
        stripe_customer_id: {
          not: null,
        },
      },
      include: {
        subscription: true,
      },
    });

    for (const org of organizations) {
      if (!org.subscription?.stripe_subscription_id) continue;

      // Get usage from TimescaleDB
      const usage = await this.getUsageForPeriod(
        org.id,
        this.getCurrentPeriodStart(),
        new Date()
      );

      // Get subscription items from Stripe
      const subscription = await this.stripe.subscriptions.retrieve(
        org.subscription.stripe_subscription_id
      );

      // Find metered items
      const eventItem = subscription.items.data.find(
        item => item.price.id === process.env.STRIPE_EVENTS_PRICE_ID
      );

      const aiTokenItem = subscription.items.data.find(
        item => item.price.id === process.env.STRIPE_AI_TOKENS_PRICE_ID
      );

      const storageItem = subscription.items.data.find(
        item => item.price.id === process.env.STRIPE_STORAGE_PRICE_ID
      );

      // Report usage
      if (eventItem && usage.events > 0) {
        await this.stripe.recordUsage({
          subscriptionItemId: eventItem.id,
          quantity: usage.events,
          action: 'set',
        });
      }

      if (aiTokenItem && usage.aiTokens > 0) {
        await this.stripe.recordUsage({
          subscriptionItemId: aiTokenItem.id,
          quantity: Math.ceil(usage.aiTokens / 1000), // Report in 1k blocks
          action: 'set',
        });
      }

      if (storageItem && usage.storageGb > 0) {
        await this.stripe.recordUsage({
          subscriptionItemId: storageItem.id,
          quantity: Math.ceil(usage.storageGb),
          action: 'set',
        });
      }

      // Mark records as synced
      await db.usage_records.updateMany({
        where: {
          organization_id: org.id,
          synced_to_stripe: false,
          timestamp: {
            gte: this.getCurrentPeriodStart(),
            lte: new Date(),
          },
        },
        data: {
          synced_to_stripe: true,
        },
      });
    }
  }

  // Get current usage for organization
  async getCurrentUsage(organizationId: string) {
    const period = this.getCurrentPeriod();
    const keys = [
      `usage:${organizationId}:events:${period}`,
      `usage:${organizationId}:ai_tokens:${period}`,
      `usage:${organizationId}:storage:current`,
    ];

    const values = await this.redis.mget(keys);

    return {
      events: parseInt(values[0] || '0'),
      aiTokens: parseInt(values[1] || '0'),
      storageGb: parseInt(values[2] || '0') / 1_000_000_000, // Convert bytes to GB
    };
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  private getCurrentPeriodStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private async getUsageForPeriod(
    organizationId: string,
    start: Date,
    end: Date
  ) {
    const result = await db.query(`
      SELECT
        metric_type,
        SUM(value) as total
      FROM usage_records
      WHERE organization_id = $1
        AND timestamp >= $2
        AND timestamp <= $3
        AND synced_to_stripe = false
      GROUP BY metric_type
    `, [organizationId, start, end]);

    return {
      events: result.find(r => r.metric_type === 'events')?.total || 0,
      aiTokens: result.find(r => r.metric_type === 'ai_tokens')?.total || 0,
      storageGb: result.find(r => r.metric_type === 'storage_gb')?.total || 0,
    };
  }
}
```

## Phase 3: Self-Serve Flow (Weeks 3-4)

### 3.1 Pricing Page Component

```tsx
// app/(marketing)/pricing/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { STRIPE_PRODUCTS } from '@/config/products';

export default function PricingPage() {
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [isAcademic, setIsAcademic] = useState(false);

  const tiers = isAcademic ? STRIPE_PRODUCTS.academic : STRIPE_PRODUCTS.tiers;
  const discount = billingPeriod === 'annual' ? 0.2 : 0; // 20% annual discount

  const handleSelectTier = async (tier: string) => {
    // For Core and Team, go to checkout
    if (tier === 'core' || tier === 'team') {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier,
          billingPeriod,
          isAcademic,
        }),
      });

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } else {
      // For Scale and Enterprise, go to contact sales
      router.push(`/contact-sales?tier=${tier}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Simple, Instrument-Based Pricing
        </h1>
        <p className="text-xl text-gray-600">
          Pay for throughput, not seats. Scale as you grow.
        </p>
      </div>

      {/* Billing Period Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded ${
              billingPeriod === 'monthly'
                ? 'bg-white shadow-sm'
                : 'text-gray-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded ${
              billingPeriod === 'annual'
                ? 'bg-white shadow-sm'
                : 'text-gray-600'
            }`}
          >
            Annual (Save 20%)
          </button>
        </div>
      </div>

      {/* Academic Toggle */}
      <div className="flex justify-center mb-12">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isAcademic}
            onChange={(e) => setIsAcademic(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm">
            I'm from an academic institution (40% discount)
          </span>
        </label>
      </div>

      {/* Pricing Tiers */}
      <div className="grid md:grid-cols-3 gap-8">
        {Object.entries(tiers).map(([key, tier]) => {
          const monthlyPrice = tier.price / 100;
          const finalPrice = monthlyPrice * (1 - discount);

          return (
            <div
              key={key}
              className="border rounded-lg p-8 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">
                  ${finalPrice.toLocaleString()}
                </span>
                <span className="text-gray-600">/month</span>
                {billingPeriod === 'annual' && (
                  <div className="text-sm text-green-600 mt-1">
                    Save ${(monthlyPrice * 0.2 * 12).toLocaleString()}/year
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span>Up to {tier.features.instruments} instruments</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span>{tier.features.seats} seats included</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span>{(tier.features.events / 1000000).toFixed(1)}M events/month</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span>{(tier.features.aiTokens / 1000).toFixed(0)}k AI tokens/month</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span>{tier.features.storageGb / 1000} TB storage</span>
                </div>
              </div>

              <button
                onClick={() => handleSelectTier(key)}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {key === 'scale' || key === 'enterprise'
                  ? 'Contact Sales'
                  : 'Get Started'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="mt-16 bg-gray-50 rounded-lg p-8 text-center">
        <h3 className="text-2xl font-bold mb-4">
          Need Enterprise Features?
        </h3>
        <p className="text-gray-600 mb-6">
          Unlimited instruments, custom contracts, 99.99% SLA, dedicated support
        </p>
        <button
          onClick={() => router.push('/contact-sales?tier=enterprise')}
          className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Contact Sales
        </button>
      </div>
    </div>
  );
}
```

### 3.2 Checkout API Endpoint

```typescript
// app/api/billing/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { StripeService } from '@/lib/billing/stripe.service';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tier, billingPeriod, isAcademic, addons } = await req.json();

  const stripe = new StripeService();

  // Get or create organization
  let org = await db.organizations.findFirst({
    where: { email: session.user.email },
  });

  if (!org) {
    org = await db.organizations.create({
      data: {
        email: session.user.email,
        name: session.user.name || 'Unknown',
        is_academic: isAcademic,
      },
    });
  }

  // Get or create Stripe customer
  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.createCustomer({
      email: org.email,
      name: org.name,
      organizationId: org.id,
      isAcademic,
    });

    customerId = customer.id;

    await db.organizations.update({
      where: { id: org.id },
      data: { stripe_customer_id: customerId },
    });
  }

  // Determine price ID
  const products = isAcademic ? STRIPE_PRODUCTS.academic : STRIPE_PRODUCTS.tiers;
  const tierProduct = products[tier];

  if (!tierProduct) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  // Create checkout session
  const checkoutSession = await stripe.createCheckoutSession({
    customerId,
    priceId: tierProduct.priceId,
    tier,
    successUrl: `${process.env.NEXT_PUBLIC_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    addons,
  });

  return NextResponse.json({
    checkoutUrl: checkoutSession.url,
  });
}
```

## Phase 4: Billing Dashboard (Week 5)

### 4.1 Usage Dashboard Component

```tsx
// app/(dashboard)/billing/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowUpRight, AlertCircle } from 'lucide-react';

export default function BillingDashboard() {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    const [subRes, usageRes, entRes] = await Promise.all([
      fetch('/api/billing/subscription'),
      fetch('/api/billing/usage'),
      fetch('/api/billing/entitlements'),
    ]);

    const [sub, use, ent] = await Promise.all([
      subRes.json(),
      usageRes.json(),
      entRes.json(),
    ]);

    setSubscription(sub);
    setUsage(use);
    setEntitlements(ent);
    setLoading(false);
  };

  if (loading) {
    return <div>Loading billing information...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Billing & Usage</h1>

      {/* Current Plan */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">{subscription.tier}</h3>
              <p className="text-gray-600">
                ${subscription.amount / 100}/month
              </p>
              <p className="text-sm text-gray-500">
                Next billing: {new Date(subscription.nextBilling).toLocaleDateString()}
              </p>
            </div>
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Manage Plan
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {Object.entries(entitlements).map(([resource, data]) => {
          const percentage = (data.usage / data.limit) * 100;
          const isNearLimit = percentage > 80;

          return (
            <Card key={resource}>
              <CardHeader>
                <CardTitle className="capitalize">{resource}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{data.usage} used</span>
                    <span>{data.limit} limit</span>
                  </div>
                  <Progress
                    value={percentage}
                    className={isNearLimit ? 'bg-yellow-100' : ''}
                  />
                  {isNearLimit && (
                    <div className="flex items-center text-yellow-600 text-sm mt-2">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Approaching limit
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Meters */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Events This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(usage.events / 1000).toFixed(1)}k
            </div>
            <div className="text-sm text-gray-600 mt-2">
              of {(subscription.includedEvents / 1000000).toFixed(1)}M included
            </div>
            {usage.events > subscription.includedEvents && (
              <div className="text-sm text-red-600 mt-2">
                Overage: ${usage.eventOverageCharge / 100}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(usage.aiTokens / 1000).toFixed(1)}k
            </div>
            <div className="text-sm text-gray-600 mt-2">
              of {(subscription.includedAiTokens / 1000).toFixed(0)}k included
            </div>
            {usage.aiTokens > subscription.includedAiTokens && (
              <div className="text-sm text-red-600 mt-2">
                Overage: ${usage.aiTokenOverageCharge / 100}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {usage.storageGb.toFixed(1)} GB
            </div>
            <div className="text-sm text-gray-600 mt-2">
              of {subscription.includedStorageGb} GB included
            </div>
            {usage.storageGb > subscription.includedStorageGb && (
              <div className="text-sm text-red-600 mt-2">
                Overage: ${usage.storageOverageCharge / 100}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estimated Monthly Charge */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Estimated Monthly Charge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Base subscription</span>
              <span>${subscription.amount / 100}</span>
            </div>
            {subscription.addons?.map(addon => (
              <div key={addon.id} className="flex justify-between">
                <span>{addon.name}</span>
                <span>${addon.amount / 100}</span>
              </div>
            ))}
            {usage.totalOverageCharge > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Usage overages</span>
                <span>${usage.totalOverageCharge / 100}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total estimate</span>
              <span>
                ${(subscription.amount + usage.totalOverageCharge) / 100}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Phase 5: Webhook Handling (Week 6)

### 5.1 Stripe Webhooks

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { EntitlementsService } from '@/lib/billing/entitlements.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const entitlements = new EntitlementsService();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Create subscription record
      await db.subscriptions.create({
        data: {
          organization_id: session.metadata?.organization_id,
          stripe_subscription_id: session.subscription as string,
          tier: session.metadata?.tier,
          status: 'active',
          billing_period: session.metadata?.billing_period || 'monthly',
        },
      });

      // Sync entitlements
      await entitlements.syncFromSubscription(
        session.metadata?.organization_id,
        session.metadata?.tier
      );

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;

      await db.subscriptions.update({
        where: {
          stripe_subscription_id: subscription.id,
        },
        data: {
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          cancel_at_period_end: subscription.cancel_at_period_end,
        },
      });

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      await db.subscriptions.update({
        where: {
          stripe_subscription_id: subscription.id,
        },
        data: {
          status: 'canceled',
        },
      });

      break;
    }

    case 'invoice.created': {
      const invoice = event.data.object as Stripe.Invoice;

      // Add usage line items if needed
      if (invoice.subscription) {
        // This is where you'd add any manual adjustments
      }

      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;

      await db.invoices.create({
        data: {
          organization_id: invoice.metadata?.organization_id,
          stripe_invoice_id: invoice.id,
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          status: 'paid',
          paid_at: new Date(invoice.status_transitions.paid_at! * 1000),
        },
      });

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;

      // Send notification email
      // Lock account features after grace period

      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Set up Stripe account and configure products
- [ ] Create database schema
- [ ] Build Stripe service wrapper
- [ ] Implement basic checkout flow

### Week 3-4: Metering & Entitlements
- [ ] Build entitlements service
- [ ] Implement usage tracking
- [ ] Create metering pipeline
- [ ] Set up usage sync to Stripe

### Week 5: Dashboard & Self-Service
- [ ] Build pricing page
- [ ] Create billing dashboard
- [ ] Implement upgrade/downgrade flows
- [ ] Add invoice history

### Week 6: Production Readiness
- [ ] Set up webhook handlers
- [ ] Implement dunning and retry logic
- [ ] Add academic verification
- [ ] Create admin tools

## Security Considerations

1. **PCI Compliance**: Use Stripe Checkout/Elements (never handle card data)
2. **Webhook Validation**: Always verify Stripe signatures
3. **Rate Limiting**: Implement on all billing endpoints
4. **Audit Logging**: Track all billing events
5. **Encryption**: Encrypt sensitive metadata
6. **Access Control**: Role-based access to billing features

## Monitoring & Alerts

Set up alerts for:
- Failed payments
- Approaching usage limits (80% threshold)
- Subscription downgrades
- High overage charges
- Webhook failures
- Payment method expiration

## Support & Documentation

1. **Customer Portal**: Link to Stripe Customer Portal for self-service
2. **Usage Documentation**: Clear explanation of meters
3. **Pricing Calculator**: Interactive tool on website
4. **FAQ**: Common billing questions
5. **Support Tickets**: Integration with support system

## Conclusion

This implementation provides a complete billing solution that:
- Supports self-serve and sales-assisted flows
- Handles complex usage-based pricing
- Scales from startups to enterprise
- Maintains compliance and security
- Provides excellent user experience

The modular architecture allows for incremental deployment and testing at each phase.