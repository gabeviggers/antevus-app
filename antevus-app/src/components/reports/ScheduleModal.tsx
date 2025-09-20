'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ClockIcon } from '@heroicons/react/24/outline';
import { RRule } from 'rrule';

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, rrule: string, delivery?: { email?: string[] }) => void;
}

export function ScheduleModal({ open, onClose, onConfirm }: ScheduleModalProps) {
  const [name, setName] = useState('Weekly Lab Report');
  const [frequency, setFrequency] = useState('weekly');
  const [dayOfWeek, setDayOfWeek] = useState('1'); // Monday
  const [hourOfDay, setHourOfDay] = useState('8');
  const [emails, setEmails] = useState('');

  const generateRRule = () => {
    let rule: RRule;

    switch (frequency) {
      case 'daily':
        rule = new RRule({
          freq: RRule.DAILY,
          byhour: parseInt(hourOfDay),
          byminute: 0
        });
        break;
      case 'weekly':
        rule = new RRule({
          freq: RRule.WEEKLY,
          byweekday: parseInt(dayOfWeek),
          byhour: parseInt(hourOfDay),
          byminute: 0
        });
        break;
      case 'monthly':
        rule = new RRule({
          freq: RRule.MONTHLY,
          bymonthday: 1,
          byhour: parseInt(hourOfDay),
          byminute: 0
        });
        break;
      default:
        rule = new RRule({
          freq: RRule.WEEKLY,
          byweekday: RRule.MO,
          byhour: 8,
          byminute: 0
        });
    }

    return rule.toString();
  };

  const handleConfirm = () => {
    const rrule = generateRRule();
    const emailList = emails
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    onConfirm(
      name,
      rrule,
      emailList.length > 0 ? { email: emailList } : undefined
    );
  };

  const getPreviewText = () => {
    const hour = parseInt(hourOfDay);
    const timeStr = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

    switch (frequency) {
      case 'daily':
        return `Every day at ${timeStr}`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Every ${days[parseInt(dayOfWeek)]} at ${timeStr}`;
      case 'monthly':
        return `First day of every month at ${timeStr}`;
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Schedule Report
          </DialogTitle>
          <DialogDescription>
            Set up automatic report generation and delivery
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Report Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly Lab Report"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequency === 'weekly' && (
              <div className="space-y-2">
                <Label htmlFor="day">Day of Week</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger id="day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                    <SelectItem value="0">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Select value={hourOfDay} onValueChange={setHourOfDay}>
                <SelectTrigger id="time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6:00 AM</SelectItem>
                  <SelectItem value="7">7:00 AM</SelectItem>
                  <SelectItem value="8">8:00 AM</SelectItem>
                  <SelectItem value="9">9:00 AM</SelectItem>
                  <SelectItem value="10">10:00 AM</SelectItem>
                  <SelectItem value="11">11:00 AM</SelectItem>
                  <SelectItem value="12">12:00 PM</SelectItem>
                  <SelectItem value="13">1:00 PM</SelectItem>
                  <SelectItem value="14">2:00 PM</SelectItem>
                  <SelectItem value="15">3:00 PM</SelectItem>
                  <SelectItem value="16">4:00 PM</SelectItem>
                  <SelectItem value="17">5:00 PM</SelectItem>
                  <SelectItem value="18">6:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emails">Email Recipients (optional)</Label>
            <Input
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="qa-team@lab.com, manager@lab.com"
              type="email"
            />
            <p className="text-xs text-gray-500">
              Comma-separated email addresses to receive the report
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">Schedule Preview</p>
            <p className="text-sm text-gray-600">{getPreviewText()}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
            Schedule Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}