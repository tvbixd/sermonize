import React from 'react';
import { LegalPage } from '@/components/LegalPage';
import { TERMS_TEXT } from '@/config/legal';

export default function TermsScreen() {
  return <LegalPage title="Terms of Use" body={TERMS_TEXT} />;
}
