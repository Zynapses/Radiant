// RADIANT v4.18.0 - Domain Ethics Registry
// Predefined professional ethics frameworks for domain-specific guidance

import type {
  DomainEthicsFramework,
  LegalEthicsFramework,
  MedicalEthicsFramework,
  FinancialEthicsFramework,
  EngineeringEthicsFramework,
} from '../types/domain-ethics.types';

// ============================================================================
// LEGAL ETHICS (Bar Association, ABA Model Rules)
// ============================================================================

export const LEGAL_ETHICS_ABA: LegalEthicsFramework = {
  id: 'legal-aba-model-rules',
  domain: 'legal',
  subspecialties: ['litigation', 'corporate', 'criminal', 'family', 'immigration', 'intellectual_property', 'tax', 'real_estate'],
  
  frameworkName: 'ABA Model Rules of Professional Conduct',
  frameworkCode: 'ABA',
  governingBody: 'American Bar Association',
  jurisdiction: 'US',
  
  description: 'The ABA Model Rules serve as the basis for professional responsibility standards in most U.S. jurisdictions.',
  websiteUrl: 'https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/',
  lastUpdated: new Date('2024-08-01'),
  
  barAssociation: 'American Bar Association',
  ruleSet: 'ABA Model Rules',
  
  principles: [
    {
      id: 'aba-1.1',
      code: 'Rule 1.1',
      title: 'Competence',
      description: 'A lawyer shall provide competent representation to a client, requiring legal knowledge, skill, thoroughness, and preparation.',
      category: 'competence',
      priority: 10,
      isAbsolute: true,
      examples: ['Must have adequate knowledge of the relevant area of law', 'Must prepare thoroughly for matters'],
    },
    {
      id: 'aba-1.3',
      code: 'Rule 1.3',
      title: 'Diligence',
      description: 'A lawyer shall act with reasonable diligence and promptness in representing a client.',
      category: 'diligence',
      priority: 9,
      isAbsolute: false,
    },
    {
      id: 'aba-1.4',
      code: 'Rule 1.4',
      title: 'Communication',
      description: 'A lawyer shall keep the client reasonably informed about the status of the matter and promptly comply with reasonable requests for information.',
      category: 'communication',
      priority: 8,
      isAbsolute: false,
    },
    {
      id: 'aba-1.6',
      code: 'Rule 1.6',
      title: 'Confidentiality of Information',
      description: 'A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent.',
      category: 'confidentiality',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'aba-1.7',
      code: 'Rule 1.7',
      title: 'Conflict of Interest: Current Clients',
      description: 'A lawyer shall not represent a client if the representation involves a concurrent conflict of interest.',
      category: 'conflict_of_interest',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'aba-3.3',
      code: 'Rule 3.3',
      title: 'Candor Toward the Tribunal',
      description: 'A lawyer shall not knowingly make a false statement of fact or law to a tribunal.',
      category: 'duties_to_court',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'aba-5.5',
      code: 'Rule 5.5',
      title: 'Unauthorized Practice of Law',
      description: 'A lawyer shall not practice law in a jurisdiction in violation of the regulation of the legal profession.',
      category: 'unauthorized_practice',
      priority: 10,
      isAbsolute: true,
    },
  ],
  
  prohibitions: [
    {
      id: 'aba-prohibit-upl',
      code: 'Rule 5.5',
      title: 'Providing Legal Advice Without License',
      description: 'Cannot provide specific legal advice that constitutes the practice of law without proper licensing.',
      category: 'unauthorized_practice',
      severity: 'critical',
      triggerKeywords: ['you should sue', 'file a lawsuit', 'i advise you to', 'legal advice:', 'as your attorney'],
      actionOnViolation: 'modify',
      alternativeGuidance: 'Provide general legal information with appropriate disclaimers, and recommend consulting a licensed attorney.',
    },
    {
      id: 'aba-prohibit-guarantee',
      title: 'Guaranteeing Outcomes',
      description: 'Cannot guarantee or promise specific legal outcomes.',
      category: 'professional_conduct',
      severity: 'major',
      triggerKeywords: ['you will win', 'guaranteed to succeed', 'certain victory', 'definitely will'],
      actionOnViolation: 'modify',
      alternativeGuidance: 'Discuss potential outcomes in terms of possibilities and factors that may influence results.',
    },
    {
      id: 'aba-prohibit-confidential',
      title: 'Revealing Confidential Information',
      description: 'Cannot reveal or encourage revelation of privileged attorney-client communications.',
      category: 'confidentiality',
      severity: 'critical',
      triggerKeywords: ['tell everyone', 'make public', 'disclose to media'],
      actionOnViolation: 'warn',
      alternativeGuidance: 'Remind about attorney-client privilege protections.',
    },
  ],
  
  disclosureRequirements: [
    {
      id: 'legal-disclaimer-1',
      title: 'Not Legal Advice Disclaimer',
      description: 'Must clarify that AI-generated content is not legal advice.',
      triggerConditions: ['legal question', 'law question', 'legal matter'],
      disclosureText: '**Important:** This information is for educational purposes only and does not constitute legal advice. For advice specific to your situation, please consult a licensed attorney in your jurisdiction.',
      placement: 'after',
      isRequired: true,
    },
    {
      id: 'legal-disclaimer-2',
      title: 'Jurisdiction Variance',
      description: 'Laws vary by jurisdiction.',
      triggerConditions: ['state law', 'federal law', 'jurisdiction'],
      disclosureText: 'Laws vary significantly by jurisdiction. The information provided may not apply in your specific location.',
      placement: 'after',
      isRequired: true,
    },
  ],
  
  requiredDisclaimers: [
    'This is general legal information, not legal advice.',
    'For specific legal advice, consult a licensed attorney.',
    'Laws vary by jurisdiction and may have changed since this information was compiled.',
  ],
  
  mandatoryWarnings: [
    'Do not rely solely on this information for legal decisions.',
    'Statutes of limitations and procedural requirements may apply to your situation.',
  ],
  
  enforcementLevel: 'strict',
  isActive: true,
  canBeDisabled: false,
};

// ============================================================================
// MEDICAL ETHICS (AMA, Hippocratic Principles)
// ============================================================================

export const MEDICAL_ETHICS_AMA: MedicalEthicsFramework = {
  id: 'medical-ama-ethics',
  domain: 'healthcare',
  subspecialties: ['general_medicine', 'surgery', 'psychiatry', 'pediatrics', 'oncology', 'cardiology', 'neurology', 'emergency'],
  
  frameworkName: 'AMA Code of Medical Ethics',
  frameworkCode: 'AMA',
  governingBody: 'American Medical Association',
  jurisdiction: 'US',
  
  description: 'The AMA Code of Medical Ethics guides physicians in their professional conduct and patient care.',
  websiteUrl: 'https://www.ama-assn.org/delivering-care/ethics/code-medical-ethics-overview',
  lastUpdated: new Date('2024-06-01'),
  
  medicalBoard: 'American Medical Association',
  codeOfEthics: 'AMA',
  
  principles: [
    {
      id: 'ama-1',
      code: 'Principle I',
      title: 'Competent Medical Care with Compassion',
      description: 'A physician shall be dedicated to providing competent medical care, with compassion and respect for human dignity and rights.',
      category: 'competence',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'ama-2',
      code: 'Principle II',
      title: 'Honesty in Professional Dealings',
      description: 'A physician shall uphold the standards of professionalism, be honest in all professional interactions.',
      category: 'professional_conduct',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'ama-4',
      code: 'Principle IV',
      title: 'Patient Rights and Confidentiality',
      description: 'A physician shall respect the rights of patients, colleagues, and other health professionals, and shall safeguard patient confidences.',
      category: 'confidentiality',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'ama-5',
      code: 'Principle V',
      title: 'Continuing Medical Education',
      description: 'A physician shall continue to study, apply, and advance scientific knowledge.',
      category: 'competence',
      priority: 8,
      isAbsolute: false,
    },
    {
      id: 'ama-informed-consent',
      code: 'Opinion 2.1.1',
      title: 'Informed Consent',
      description: 'Patients have the right to receive information and ask questions about recommended treatments so that they can make well-considered decisions about care.',
      category: 'informed_consent',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'ama-nonmaleficence',
      code: 'Hippocratic',
      title: 'Do No Harm (Primum Non Nocere)',
      description: 'First, do no harm. Physicians must weigh the potential benefits against potential harms of any intervention.',
      category: 'standard_of_care',
      priority: 10,
      isAbsolute: true,
    },
  ],
  
  prohibitions: [
    {
      id: 'medical-prohibit-diagnosis',
      title: 'Providing Medical Diagnosis',
      description: 'Cannot diagnose medical conditions without proper examination and credentials.',
      category: 'unauthorized_practice',
      severity: 'critical',
      triggerKeywords: ['you have', 'your diagnosis is', 'i diagnose', 'this is definitely'],
      actionOnViolation: 'modify',
      alternativeGuidance: 'Describe possible conditions and strongly recommend professional medical evaluation.',
    },
    {
      id: 'medical-prohibit-treatment',
      title: 'Prescribing Treatment',
      description: 'Cannot prescribe specific medications or treatments.',
      category: 'unauthorized_practice',
      severity: 'critical',
      triggerKeywords: ['take this medication', 'you should take', 'prescription:', 'dose should be'],
      actionOnViolation: 'modify',
      alternativeGuidance: 'Discuss treatment options in general terms and emphasize the need for professional medical advice.',
    },
    {
      id: 'medical-prohibit-emergency',
      title: 'Delaying Emergency Care',
      description: 'Must not delay emergency medical care by providing detailed advice for emergent situations.',
      category: 'standard_of_care',
      severity: 'critical',
      triggerKeywords: ['heart attack', 'stroke', 'can\'t breathe', 'severe bleeding', 'unconscious', 'seizure'],
      actionOnViolation: 'block',
      alternativeGuidance: 'Immediately direct to call emergency services (911) before any other information.',
    },
  ],
  
  disclosureRequirements: [
    {
      id: 'medical-disclaimer-1',
      title: 'Not Medical Advice Disclaimer',
      description: 'Must clarify that AI-generated content is not medical advice.',
      triggerConditions: ['medical question', 'health question', 'symptom'],
      disclosureText: '**Important:** This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare provider with any questions about a medical condition.',
      placement: 'after',
      isRequired: true,
    },
    {
      id: 'medical-disclaimer-emergency',
      title: 'Emergency Warning',
      description: 'Must warn about emergencies.',
      triggerConditions: ['chest pain', 'difficulty breathing', 'severe pain', 'bleeding'],
      disclosureText: '⚠️ **If this is a medical emergency, call 911 or your local emergency number immediately.**',
      placement: 'before',
      isRequired: true,
    },
  ],
  
  requiredDisclaimers: [
    'This is general health information, not medical advice.',
    'Consult a healthcare professional for personal medical advice.',
    'Do not delay seeking medical attention based on information provided here.',
  ],
  
  mandatoryWarnings: [
    'If you are experiencing a medical emergency, call 911 immediately.',
    'Individual medical conditions require personalized professional evaluation.',
  ],
  
  enforcementLevel: 'strict',
  isActive: true,
  canBeDisabled: false,
};

// ============================================================================
// FINANCIAL ETHICS (CFP, SEC, FINRA)
// ============================================================================

export const FINANCIAL_ETHICS_CFP: FinancialEthicsFramework = {
  id: 'financial-cfp-standards',
  domain: 'finance',
  subspecialties: ['investment', 'retirement', 'tax_planning', 'estate_planning', 'insurance', 'banking'],
  
  frameworkName: 'CFP Board Code of Ethics and Standards of Conduct',
  frameworkCode: 'CFP',
  governingBody: 'Certified Financial Planner Board of Standards',
  jurisdiction: 'US',
  
  description: 'The CFP Board Code establishes ethical and practice standards for financial planning professionals.',
  websiteUrl: 'https://www.cfp.net/ethics/code-of-ethics-and-standards-of-conduct',
  lastUpdated: new Date('2024-01-01'),
  
  regulatoryBody: 'CFP Board',
  certifications: ['CFP', 'CFA', 'ChFC'],
  regulations: ['SEC', 'FINRA', 'DOL Fiduciary Rule'],
  
  principles: [
    {
      id: 'cfp-fiduciary',
      code: 'Standard A',
      title: 'Fiduciary Duty',
      description: 'A CFP professional must act as a fiduciary when providing financial advice, placing the client\'s interests first.',
      category: 'fiduciary_duty',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'cfp-integrity',
      code: 'Standard B',
      title: 'Integrity',
      description: 'A CFP professional must provide services with integrity, being honest and candid.',
      category: 'professional_conduct',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'cfp-competence',
      code: 'Standard C',
      title: 'Competence',
      description: 'A CFP professional must provide services competently, maintaining necessary knowledge and skill.',
      category: 'competence',
      priority: 9,
      isAbsolute: false,
    },
    {
      id: 'cfp-diligence',
      code: 'Standard D',
      title: 'Diligence',
      description: 'A CFP professional must provide services diligently, in a manner that best serves the client.',
      category: 'diligence',
      priority: 8,
      isAbsolute: false,
    },
    {
      id: 'cfp-disclosure',
      code: 'Standard E',
      title: 'Full Disclosure',
      description: 'A CFP professional must disclose material information relevant to the professional relationship.',
      category: 'disclosure',
      priority: 9,
      isAbsolute: true,
    },
  ],
  
  prohibitions: [
    {
      id: 'financial-prohibit-advice',
      title: 'Providing Personalized Investment Advice',
      description: 'Cannot provide specific investment recommendations without proper licensing and knowledge of individual circumstances.',
      category: 'unauthorized_practice',
      severity: 'critical',
      triggerKeywords: ['you should invest in', 'buy this stock', 'sell your shares', 'investment advice:'],
      actionOnViolation: 'modify',
      alternativeGuidance: 'Discuss investment concepts in general terms and recommend consulting a licensed financial advisor.',
    },
    {
      id: 'financial-prohibit-guarantee',
      title: 'Guaranteeing Investment Returns',
      description: 'Cannot guarantee or promise specific investment returns.',
      category: 'disclosure',
      severity: 'critical',
      triggerKeywords: ['guaranteed return', 'will definitely profit', 'can\'t lose money', 'risk-free investment'],
      actionOnViolation: 'block',
      alternativeGuidance: 'All investments carry risk. Past performance does not guarantee future results.',
    },
    {
      id: 'financial-prohibit-timing',
      title: 'Market Timing Predictions',
      description: 'Cannot make specific predictions about market movements or timing.',
      category: 'disclosure',
      severity: 'major',
      triggerKeywords: ['the market will', 'stock will go to', 'crash is coming', 'buy now before'],
      actionOnViolation: 'warn',
      alternativeGuidance: 'Market predictions are speculative. Discuss historical trends and principles instead.',
    },
  ],
  
  disclosureRequirements: [
    {
      id: 'financial-disclaimer-1',
      title: 'Not Financial Advice Disclaimer',
      description: 'Must clarify that AI-generated content is not personalized financial advice.',
      triggerConditions: ['investment', 'financial planning', 'retirement', 'stock'],
      disclosureText: '**Disclaimer:** This is general financial information for educational purposes only. It is not personalized investment advice. Consult a qualified financial advisor before making investment decisions.',
      placement: 'after',
      isRequired: true,
    },
    {
      id: 'financial-disclaimer-risk',
      title: 'Investment Risk Warning',
      description: 'Must warn about investment risks.',
      triggerConditions: ['invest', 'stock', 'bond', 'fund', 'portfolio'],
      disclosureText: 'All investments involve risk, including the possible loss of principal. Past performance does not guarantee future results.',
      placement: 'after',
      isRequired: true,
    },
  ],
  
  requiredDisclaimers: [
    'This is general financial information, not personalized advice.',
    'Consult a licensed financial advisor for advice specific to your situation.',
    'All investments carry risk, including potential loss of principal.',
  ],
  
  mandatoryWarnings: [
    'Past performance does not guarantee future results.',
    'Tax implications vary by individual circumstance.',
  ],
  
  enforcementLevel: 'strict',
  isActive: true,
  canBeDisabled: false,
};

// ============================================================================
// ENGINEERING ETHICS (NSPE, IEEE, ACM)
// ============================================================================

export const ENGINEERING_ETHICS_NSPE: EngineeringEthicsFramework = {
  id: 'engineering-nspe-ethics',
  domain: 'engineering',
  subspecialties: ['civil', 'mechanical', 'electrical', 'software', 'chemical', 'aerospace'],
  
  frameworkName: 'NSPE Code of Ethics for Engineers',
  frameworkCode: 'NSPE',
  governingBody: 'National Society of Professional Engineers',
  jurisdiction: 'US',
  
  description: 'The NSPE Code of Ethics establishes fundamental principles for professional engineering practice.',
  websiteUrl: 'https://www.nspe.org/resources/ethics/code-ethics',
  lastUpdated: new Date('2024-01-01'),
  
  professionalBody: 'National Society of Professional Engineers',
  codeOfEthics: 'NSPE',
  
  principles: [
    {
      id: 'nspe-1',
      code: 'Fundamental Canon I',
      title: 'Public Safety, Health, and Welfare',
      description: 'Engineers shall hold paramount the safety, health, and welfare of the public.',
      category: 'standard_of_care',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'nspe-2',
      code: 'Fundamental Canon II',
      title: 'Competence',
      description: 'Engineers shall perform services only in areas of their competence.',
      category: 'competence',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'nspe-3',
      code: 'Fundamental Canon III',
      title: 'Objective and Truthful Manner',
      description: 'Engineers shall issue public statements only in an objective and truthful manner.',
      category: 'professional_conduct',
      priority: 9,
      isAbsolute: true,
    },
    {
      id: 'nspe-5',
      code: 'Fundamental Canon V',
      title: 'Avoid Deceptive Acts',
      description: 'Engineers shall avoid deceptive acts.',
      category: 'professional_conduct',
      priority: 10,
      isAbsolute: true,
    },
  ],
  
  prohibitions: [
    {
      id: 'engineering-prohibit-seal',
      title: 'Implying Professional Engineering Stamp',
      description: 'Cannot imply that designs or calculations have been reviewed or stamped by a licensed PE.',
      category: 'unauthorized_practice',
      severity: 'critical',
      triggerKeywords: ['PE approved', 'engineer certified', 'professionally stamped', 'sealed drawings'],
      actionOnViolation: 'modify',
      alternativeGuidance: 'Clarify that all engineering designs must be reviewed and sealed by a licensed Professional Engineer.',
    },
    {
      id: 'engineering-prohibit-safety',
      title: 'Compromising Safety Standards',
      description: 'Cannot suggest bypassing safety codes or standards.',
      category: 'standard_of_care',
      severity: 'critical',
      triggerKeywords: ['skip the safety', 'ignore the code', 'bypass regulations', 'doesn\'t need inspection'],
      actionOnViolation: 'block',
      alternativeGuidance: 'All engineering work must comply with applicable codes and safety standards.',
    },
  ],
  
  disclosureRequirements: [
    {
      id: 'engineering-disclaimer-1',
      title: 'Not Professional Engineering Advice',
      description: 'Must clarify that AI-generated content is not professional engineering advice.',
      triggerConditions: ['engineering', 'structural', 'design calculation', 'building'],
      disclosureText: '**Disclaimer:** This information is for educational purposes only. All engineering designs and calculations should be reviewed by a licensed Professional Engineer (PE) before implementation.',
      placement: 'after',
      isRequired: true,
    },
  ],
  
  requiredDisclaimers: [
    'This is general engineering information, not professional engineering advice.',
    'All designs should be reviewed and sealed by a licensed Professional Engineer.',
    'Local codes and regulations must be verified before implementation.',
  ],
  
  mandatoryWarnings: [
    'Engineering work requires proper licensing and code compliance.',
    'Safety-critical designs must be verified by qualified professionals.',
  ],
  
  enforcementLevel: 'strict',
  isActive: true,
  canBeDisabled: false,
};

// ============================================================================
// JOURNALISM ETHICS
// ============================================================================

export const JOURNALISM_ETHICS_SPJ: DomainEthicsFramework = {
  id: 'journalism-spj-ethics',
  domain: 'journalism',
  subspecialties: ['news', 'investigative', 'opinion', 'broadcast'],
  
  frameworkName: 'SPJ Code of Ethics',
  frameworkCode: 'SPJ',
  governingBody: 'Society of Professional Journalists',
  jurisdiction: 'Global',
  
  description: 'The SPJ Code of Ethics is the most widely adopted set of ethical guidelines for journalists.',
  websiteUrl: 'https://www.spj.org/ethicscode.asp',
  lastUpdated: new Date('2014-09-06'),
  
  principles: [
    {
      id: 'spj-1',
      code: 'Seek Truth',
      title: 'Seek Truth and Report It',
      description: 'Ethical journalism should be accurate and fair. Journalists should be honest and courageous in gathering, reporting and interpreting information.',
      category: 'professional_conduct',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'spj-2',
      code: 'Minimize Harm',
      title: 'Minimize Harm',
      description: 'Ethical journalism treats sources, subjects, colleagues and members of the public as human beings deserving of respect.',
      category: 'standard_of_care',
      priority: 9,
      isAbsolute: false,
    },
    {
      id: 'spj-3',
      code: 'Act Independently',
      title: 'Act Independently',
      description: 'The highest and primary obligation of ethical journalism is to serve the public.',
      category: 'conflict_of_interest',
      priority: 9,
      isAbsolute: false,
    },
    {
      id: 'spj-4',
      code: 'Be Accountable',
      title: 'Be Accountable and Transparent',
      description: 'Ethical journalism means taking responsibility for one\'s work and explaining one\'s decisions to the public.',
      category: 'professional_conduct',
      priority: 8,
      isAbsolute: false,
    },
  ],
  
  prohibitions: [
    {
      id: 'journalism-prohibit-fabrication',
      title: 'Fabricating Information',
      description: 'Cannot fabricate quotes, sources, or facts.',
      category: 'professional_conduct',
      severity: 'critical',
      triggerKeywords: ['fake quote', 'fabricated source', 'made up story'],
      actionOnViolation: 'block',
      alternativeGuidance: 'All information must be verifiable and accurately sourced.',
    },
  ],
  
  disclosureRequirements: [
    {
      id: 'journalism-disclaimer-1',
      title: 'AI-Generated Content Disclosure',
      description: 'Must disclose when content is AI-generated.',
      triggerConditions: ['article', 'news', 'report'],
      disclosureText: 'This content was generated with AI assistance. Information should be independently verified.',
      placement: 'before',
      isRequired: true,
    },
  ],
  
  requiredDisclaimers: [
    'AI-generated content should be independently verified.',
  ],
  
  mandatoryWarnings: [],
  
  enforcementLevel: 'standard',
  isActive: true,
  canBeDisabled: true,
};

// ============================================================================
// PSYCHOLOGY/THERAPY ETHICS
// ============================================================================

export const PSYCHOLOGY_ETHICS_APA: DomainEthicsFramework = {
  id: 'psychology-apa-ethics',
  domain: 'psychology',
  subspecialties: ['clinical', 'counseling', 'school', 'industrial'],
  
  frameworkName: 'APA Ethical Principles of Psychologists',
  frameworkCode: 'APA-PSY',
  governingBody: 'American Psychological Association',
  jurisdiction: 'US',
  
  description: 'The APA Ethical Principles provide standards for psychologists\' professional conduct.',
  websiteUrl: 'https://www.apa.org/ethics/code',
  lastUpdated: new Date('2017-01-01'),
  
  principles: [
    {
      id: 'apa-a',
      code: 'Principle A',
      title: 'Beneficence and Nonmaleficence',
      description: 'Psychologists strive to benefit those with whom they work and take care to do no harm.',
      category: 'standard_of_care',
      priority: 10,
      isAbsolute: true,
    },
    {
      id: 'apa-b',
      code: 'Principle B',
      title: 'Fidelity and Responsibility',
      description: 'Psychologists establish relationships of trust and are aware of their professional responsibilities.',
      category: 'professional_conduct',
      priority: 9,
      isAbsolute: false,
    },
    {
      id: 'apa-e',
      code: 'Principle E',
      title: 'Respect for Rights and Dignity',
      description: 'Psychologists respect the dignity and worth of all people and the rights of individuals to privacy, confidentiality, and self-determination.',
      category: 'confidentiality',
      priority: 10,
      isAbsolute: true,
    },
  ],
  
  prohibitions: [
    {
      id: 'psychology-prohibit-diagnosis',
      title: 'Providing Psychological Diagnosis',
      description: 'Cannot diagnose mental health conditions.',
      category: 'unauthorized_practice',
      severity: 'critical',
      triggerKeywords: ['you have depression', 'you are bipolar', 'your diagnosis is', 'you have anxiety disorder'],
      actionOnViolation: 'modify',
      alternativeGuidance: 'Describe symptoms and recommend evaluation by a licensed mental health professional.',
    },
    {
      id: 'psychology-prohibit-crisis',
      title: 'Crisis Intervention',
      description: 'Cannot provide crisis intervention for suicidal or self-harm situations.',
      category: 'standard_of_care',
      severity: 'critical',
      triggerKeywords: ['want to die', 'kill myself', 'suicidal', 'self-harm', 'end my life'],
      actionOnViolation: 'block',
      alternativeGuidance: 'Immediately provide crisis hotline information (988 Suicide & Crisis Lifeline).',
    },
  ],
  
  disclosureRequirements: [
    {
      id: 'psychology-disclaimer-1',
      title: 'Not Therapy Disclaimer',
      description: 'Must clarify that AI is not therapy.',
      triggerConditions: ['mental health', 'therapy', 'counseling', 'depression', 'anxiety'],
      disclosureText: '**Important:** This is not therapy or mental health treatment. If you are struggling with mental health concerns, please reach out to a licensed mental health professional. If you are in crisis, contact the 988 Suicide & Crisis Lifeline.',
      placement: 'after',
      isRequired: true,
    },
  ],
  
  requiredDisclaimers: [
    'This is not therapy or mental health treatment.',
    'For mental health support, consult a licensed professional.',
    'Crisis resources: 988 Suicide & Crisis Lifeline',
  ],
  
  mandatoryWarnings: [
    'If you are having thoughts of suicide or self-harm, please call 988 immediately.',
  ],
  
  enforcementLevel: 'strict',
  isActive: true,
  canBeDisabled: false,
};

// ============================================================================
// COMBINED REGISTRY
// ============================================================================

export const DOMAIN_ETHICS_REGISTRY: DomainEthicsFramework[] = [
  LEGAL_ETHICS_ABA,
  MEDICAL_ETHICS_AMA,
  FINANCIAL_ETHICS_CFP,
  ENGINEERING_ETHICS_NSPE,
  JOURNALISM_ETHICS_SPJ,
  PSYCHOLOGY_ETHICS_APA,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getEthicsFrameworkByDomain(domain: string): DomainEthicsFramework | undefined {
  return DOMAIN_ETHICS_REGISTRY.find(f => f.domain === domain);
}

export function getEthicsFrameworkById(id: string): DomainEthicsFramework | undefined {
  return DOMAIN_ETHICS_REGISTRY.find(f => f.id === id);
}

export function getEthicsFrameworksByJurisdiction(jurisdiction: string): DomainEthicsFramework[] {
  return DOMAIN_ETHICS_REGISTRY.filter(f => f.jurisdiction === jurisdiction || f.jurisdiction === 'Global');
}

export function getActiveFrameworks(): DomainEthicsFramework[] {
  return DOMAIN_ETHICS_REGISTRY.filter(f => f.isActive);
}

export function getFrameworksForSubspecialty(subspecialty: string): DomainEthicsFramework[] {
  return DOMAIN_ETHICS_REGISTRY.filter(f => 
    f.subspecialties?.includes(subspecialty)
  );
}
