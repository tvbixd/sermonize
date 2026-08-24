import React from 'react';
import { LegalPage } from '@/components/LegalPage';
import { PRIVACY_POLICY_TEXT } from '@/config/legal';

export default function PrivacyScreen() {
  return <LegalPage title="Privacy Policy" body={PRIVACY_POLICY_TEXT} />;
}
