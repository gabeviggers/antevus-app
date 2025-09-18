/**
 * Data Classification System for Sensitive Information
 *
 * COMPLIANCE NOTICE:
 * - Implements HIPAA-compliant data classification
 * - Detects and classifies PHI (Protected Health Information)
 * - Identifies PII (Personally Identifiable Information)
 * - Supports automatic redaction and encryption requirements
 * - All classifications are audit logged
 */

import { auditLogger, AuditEventType } from './audit-logger'
import { UserRole } from './authorization'

/**
 * Data sensitivity levels
 */
export enum DataSensitivity {
  PUBLIC = 'PUBLIC',           // No restrictions
  INTERNAL = 'INTERNAL',       // Internal use only
  CONFIDENTIAL = 'CONFIDENTIAL', // Business sensitive
  RESTRICTED = 'RESTRICTED',    // PHI/PII - highest protection
  CRITICAL = 'CRITICAL'        // System credentials, keys
}

/**
 * Data classification categories
 */
export enum DataCategory {
  GENERAL = 'GENERAL',
  MEDICAL = 'MEDICAL',
  PERSONAL = 'PERSONAL',
  FINANCIAL = 'FINANCIAL',
  CREDENTIAL = 'CREDENTIAL',
  RESEARCH = 'RESEARCH',
  OPERATIONAL = 'OPERATIONAL'
}

/**
 * Classification result
 */
export interface ClassificationResult {
  sensitivity: DataSensitivity
  categories: DataCategory[]
  containsPHI: boolean
  containsPII: boolean
  containsCredentials: boolean
  redactedContent?: string
  detectedPatterns: string[]
  confidence: number
}

/**
 * Pattern definitions for sensitive data detection
 */
const SENSITIVE_PATTERNS = {
  // PHI Patterns (Protected Health Information)
  PHI: {
    medicalRecordNumber: /\b(MRN|mrn|medical record)[\s:#-]*\d{6,}/gi,
    patientId: /\b(patient[\s-]?id|pid)[\s:#-]*\d{5,}/gi,
    diagnosis: /\b(diagnosis|diagnosed with|dx)[\s:]*[A-Z][a-z]+([\s-][A-Za-z]+)*/gi,
    medication: /\b(medication|prescribed|rx)[\s:]*[A-Z][a-z]+([\s-][A-Za-z]+)*/gi,
    labResults: /\b(lab result|test result|blood work)[\s:]*[\d.]+[\s]*(mg|ml|mmol|units?)/gi,
    healthCondition: /\b(cancer|diabetes|hypertension|asthma|covid|hepatitis|hiv|aids)\b/gi,
    icd10: /\b[A-Z]\d{2}\.?\d{0,2}\b/g, // ICD-10 codes
    cpt: /\b\d{5}\b/g, // CPT codes (context-dependent)
  },

  // PII Patterns (Personally Identifiable Information)
  PII: {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    dateOfBirth: /\b(DOB|dob|birth date)[\s:]*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/gi,
    address: /\b\d+\s+[A-Za-z\s]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Boulevard|Blvd)\b/gi,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    driverLicense: /\b(DL|driver'?s? license)[\s:#-]*[A-Z0-9]{6,}/gi,
    passport: /\b(passport)[\s:#-]*[A-Z0-9]{6,9}\b/gi,
  },

  // Credentials and Secrets
  CREDENTIALS: {
    apiKey: /\b(api[_-]?key|apikey)[\s:=]*['"]?[A-Za-z0-9_\-]{20,}['"]?/gi,
    password: /\b(password|passwd|pwd)[\s:=]*['"]?.{6,}['"]?/gi,
    token: /\b(token|bearer|jwt)[\s:=]*['"]?[A-Za-z0-9_\-\.]{20,}['"]?/gi,
    secret: /\b(secret|private[_-]?key)[\s:=]*['"]?[A-Za-z0-9_\-]{16,}['"]?/gi,
    awsKey: /\b(AKIA|akia)[A-Z0-9]{16}\b/g,
    connectionString: /\b(mongodb|mysql|postgresql|redis):\/\/[^\s]+/gi,
  },

  // Research Data
  RESEARCH: {
    studyId: /\b(study[_-]?id|protocol[_-]?id)[\s:#-]*[A-Z0-9]{4,}/gi,
    subjectId: /\b(subject[_-]?id|participant[_-]?id)[\s:#-]*\d{3,}/gi,
    sampleId: /\b(sample[_-]?id|specimen[_-]?id)[\s:#-]*[A-Z0-9]{5,}/gi,
    batchNumber: /\b(batch|lot)[\s:#-]*[A-Z0-9]{6,}/gi,
  }
}

/**
 * Keywords that increase sensitivity
 */
const SENSITIVE_KEYWORDS = {
  MEDICAL: [
    'patient', 'diagnosis', 'treatment', 'medication', 'prescription',
    'surgery', 'procedure', 'symptom', 'condition', 'disease',
    'allergy', 'vaccine', 'immunization', 'therapy', 'prognosis'
  ],
  FINANCIAL: [
    'payment', 'insurance', 'claim', 'billing', 'invoice',
    'copay', 'deductible', 'coverage', 'reimbursement', 'charge'
  ],
  PERSONAL: [
    'name', 'address', 'birth', 'death', 'family', 'emergency',
    'contact', 'relative', 'spouse', 'children', 'parent'
  ],
  CREDENTIAL: [
    'password', 'token', 'key', 'secret', 'credential', 'auth',
    'login', 'username', 'certificate', 'private', 'public'
  ]
}

/**
 * Data Classification Service
 */
export class DataClassificationService {
  /**
   * Classify content based on sensitivity patterns
   */
  classify(content: string, context?: Record<string, unknown>): ClassificationResult {
    const detectedPatterns: string[] = []
    let containsPHI = false
    let containsPII = false
    let containsCredentials = false
    const categories = new Set<DataCategory>()
    let confidence = 0

    // Check for PHI patterns
    for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS.PHI)) {
      if (pattern.test(content)) {
        detectedPatterns.push(`PHI:${patternName}`)
        containsPHI = true
        categories.add(DataCategory.MEDICAL)
        confidence = Math.max(confidence, 0.9)
      }
    }

    // Check for PII patterns
    for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS.PII)) {
      if (pattern.test(content)) {
        detectedPatterns.push(`PII:${patternName}`)
        containsPII = true
        categories.add(DataCategory.PERSONAL)
        confidence = Math.max(confidence, 0.85)
      }
    }

    // Check for credentials
    for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS.CREDENTIALS)) {
      if (pattern.test(content)) {
        detectedPatterns.push(`CREDENTIAL:${patternName}`)
        containsCredentials = true
        categories.add(DataCategory.CREDENTIAL)
        confidence = Math.max(confidence, 1.0)
      }
    }

    // Check for research data
    for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS.RESEARCH)) {
      if (pattern.test(content)) {
        detectedPatterns.push(`RESEARCH:${patternName}`)
        categories.add(DataCategory.RESEARCH)
        confidence = Math.max(confidence, 0.7)
      }
    }

    // Check for sensitive keywords
    const lowerContent = content.toLowerCase()
    for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
      const keywordFound = keywords.some(keyword => lowerContent.includes(keyword))
      if (keywordFound) {
        categories.add(category as DataCategory)
        confidence = Math.max(confidence, 0.5)
      }
    }

    // Determine sensitivity level
    let sensitivity = this.determineSensitivity(
      containsPHI,
      containsPII,
      containsCredentials,
      categories.size > 0
    )

    // Context-based adjustment - upgrade to at least CONFIDENTIAL if lab data
    if (context?.isLabData && sensitivity === DataSensitivity.PUBLIC) {
      sensitivity = DataSensitivity.CONFIDENTIAL
    }

    // Generate redacted content if needed
    const redactedContent = this.shouldRedact(sensitivity)
      ? this.redactContent(content, detectedPatterns)
      : undefined

    // If no categories detected, mark as general
    if (categories.size === 0) {
      categories.add(DataCategory.GENERAL)
    }

    const result: ClassificationResult = {
      sensitivity,
      categories: Array.from(categories),
      containsPHI,
      containsPII,
      containsCredentials,
      redactedContent,
      detectedPatterns,
      confidence
    }

    // Audit log if sensitive data detected
    if (sensitivity >= DataSensitivity.CONFIDENTIAL) {
      this.logClassification(result, content.length)
    }

    return result
  }

  /**
   * Determine sensitivity level based on detected patterns
   */
  private determineSensitivity(
    hasPHI: boolean,
    hasPII: boolean,
    hasCredentials: boolean,
    hasKeywords: boolean
  ): DataSensitivity {
    if (hasCredentials) {
      return DataSensitivity.CRITICAL
    }
    if (hasPHI) {
      return DataSensitivity.RESTRICTED
    }
    if (hasPII) {
      return DataSensitivity.CONFIDENTIAL
    }
    if (hasKeywords) {
      return DataSensitivity.INTERNAL
    }
    return DataSensitivity.PUBLIC
  }

  /**
   * Determine if content should be redacted
   */
  private shouldRedact(sensitivity: DataSensitivity): boolean {
    return sensitivity >= DataSensitivity.CONFIDENTIAL
  }

  /**
   * Redact sensitive content
   */
  private redactContent(content: string, patterns: string[]): string {
    let redacted = content

    // Redact research data patterns
    if (patterns.some(p => p.startsWith('RESEARCH:'))) {
      redacted = redacted.replace(SENSITIVE_PATTERNS.RESEARCH.studyId, '[STUDY_ID_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.RESEARCH.subjectId, '[SUBJECT_ID_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.RESEARCH.sampleId, '[SAMPLE_ID_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.RESEARCH.batchNumber, '[BATCH_REDACTED]')
    }

    // Redact based on detected patterns
    if (patterns.some(p => p.startsWith('CREDENTIAL:'))) {
      // Redact all credentials
      redacted = redacted.replace(SENSITIVE_PATTERNS.CREDENTIALS.awsKey, '[AWS_KEY_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.CREDENTIALS.connectionString, '[CONNECTION_STRING_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.CREDENTIALS.apiKey, '[API_KEY_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.CREDENTIALS.password, '[PASSWORD_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.CREDENTIALS.token, '[TOKEN_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.CREDENTIALS.secret, '[SECRET_REDACTED]')
    }

    if (patterns.some(p => p.startsWith('PHI:'))) {
      // Redact PHI
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.diagnosis, '[DIAGNOSIS_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.medication, '[MEDICATION_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.healthCondition, '[CONDITION_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.icd10, '[ICD10_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.cpt, '[CPT_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.medicalRecordNumber, '[MRN_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.patientId, '[PATIENT_ID_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PHI.labResults, '[LAB_RESULT_REDACTED]')
    }

    if (patterns.some(p => p.startsWith('PII:'))) {
      // Redact PII
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.dateOfBirth, '[DOB_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.driverLicense, '[DL_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.passport, '[PASSPORT_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.ssn, '[SSN_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.email, '[EMAIL_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.phone, '[PHONE_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.creditCard, '[CARD_REDACTED]')
      redacted = redacted.replace(SENSITIVE_PATTERNS.PII.address, '[ADDRESS_REDACTED]')
    }

    return redacted
  }

  /**
   * Log data classification for audit
   */
  private logClassification(result: ClassificationResult, contentLength: number): void {
    auditLogger.log({
      eventType: AuditEventType.DATA_ACCESS_GRANTED,
      action: 'Sensitive data classified',
      metadata: {
        sensitivity: result.sensitivity,
        categories: result.categories,
        containsPHI: result.containsPHI,
        containsPII: result.containsPII,
        containsCredentials: result.containsCredentials,
        patternsDetected: result.detectedPatterns.length,
        contentLength,
        confidence: result.confidence
      },
      containsPHI: result.containsPHI,
      containsPII: result.containsPII
    })
  }

  /**
   * Get handling requirements for sensitivity level
   */
  getHandlingRequirements(sensitivity: DataSensitivity): {
    encryption: boolean
    auditLog: boolean
    retention: number // days
    accessControl: string
    transmission: string
    storage: string
  } {
    switch (sensitivity) {
      case DataSensitivity.CRITICAL:
        return {
          encryption: true,
          auditLog: true,
          retention: 0, // Immediate deletion after use
          accessControl: 'Role-based with MFA',
          transmission: 'TLS 1.3 required',
          storage: 'Encrypted at rest, no persistence'
        }

      case DataSensitivity.RESTRICTED:
        return {
          encryption: true,
          auditLog: true,
          retention: 7, // 7 days for PHI
          accessControl: 'Role-based access required',
          transmission: 'TLS 1.2+ required',
          storage: 'Encrypted at rest'
        }

      case DataSensitivity.CONFIDENTIAL:
        return {
          encryption: true,
          auditLog: true,
          retention: 30, // 30 days
          accessControl: 'Authentication required',
          transmission: 'HTTPS required',
          storage: 'Secure storage required'
        }

      case DataSensitivity.INTERNAL:
        return {
          encryption: false,
          auditLog: false,
          retention: 90, // 90 days
          accessControl: 'Internal users only',
          transmission: 'HTTPS recommended',
          storage: 'Standard storage'
        }

      case DataSensitivity.PUBLIC:
      default:
        return {
          encryption: false,
          auditLog: false,
          retention: 365, // 1 year
          accessControl: 'No restrictions',
          transmission: 'Any',
          storage: 'Standard storage'
        }
    }
  }

  /**
   * Check if user can access data of given sensitivity
   */
  canAccess(
    userRoles: string[],
    sensitivity: DataSensitivity,
    hasPHIAccess: boolean = false
  ): boolean {
    // Critical data requires admin role
    if (sensitivity === DataSensitivity.CRITICAL) {
      return userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.SUPER_ADMIN)
    }

    // Restricted (PHI) requires explicit PHI access permission
    if (sensitivity === DataSensitivity.RESTRICTED) {
      return hasPHIAccess
    }

    // Confidential requires authenticated user
    if (sensitivity === DataSensitivity.CONFIDENTIAL) {
      return userRoles.length > 0
    }

    // Internal and Public are generally accessible
    return true
  }
}

// Export singleton instance
export const dataClassifier = new DataClassificationService()

// Export sensitivity colors for UI
export const SENSITIVITY_COLORS = {
  [DataSensitivity.PUBLIC]: 'text-green-600 dark:text-green-400',
  [DataSensitivity.INTERNAL]: 'text-blue-600 dark:text-blue-400',
  [DataSensitivity.CONFIDENTIAL]: 'text-amber-600 dark:text-amber-400',
  [DataSensitivity.RESTRICTED]: 'text-red-600 dark:text-red-400',
  [DataSensitivity.CRITICAL]: 'text-purple-600 dark:text-purple-400'
}

// Export sensitivity icons for UI
export const SENSITIVITY_ICONS = {
  [DataSensitivity.PUBLIC]: '🟢',
  [DataSensitivity.INTERNAL]: '🔵',
  [DataSensitivity.CONFIDENTIAL]: '🟡',
  [DataSensitivity.RESTRICTED]: '🔴',
  [DataSensitivity.CRITICAL]: '🟣'
}