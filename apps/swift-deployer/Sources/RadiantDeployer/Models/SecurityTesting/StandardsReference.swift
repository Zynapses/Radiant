// RADIANT v4.18.0 - Security Standards Reference Database
// Complete mapping of OWASP, NIST, CWE, MITRE ATLAS, and ISO 27001 controls

import Foundation

// MARK: - Standards Database

struct StandardsDatabase {

    // MARK: - OWASP LLM Top 10 2025

    static let LLM01 = StandardReference(
        id: "LLM01", framework: "OWASP LLM Top 10 2025", control: "LLM01:2025",
        title: "Prompt Injection",
        description: "Direct and indirect prompt injection attacks that manipulate LLM behavior through crafted inputs, tool descriptions, or external data sources.")

    static let LLM02 = StandardReference(
        id: "LLM02", framework: "OWASP LLM Top 10 2025", control: "LLM02:2025",
        title: "Sensitive Information Disclosure",
        description: "LLM inadvertently reveals sensitive data including PII, credentials, proprietary algorithms, or system prompts through its responses.")

    static let LLM03 = StandardReference(
        id: "LLM03", framework: "OWASP LLM Top 10 2025", control: "LLM03:2025",
        title: "Supply Chain Vulnerabilities",
        description: "Risks from third-party components, pre-trained models, training data poisoning, and plugin/extension marketplace vulnerabilities.")

    static let LLM04 = StandardReference(
        id: "LLM04", framework: "OWASP LLM Top 10 2025", control: "LLM04:2025",
        title: "Data and Model Poisoning",
        description: "Manipulation of training data or fine-tuning processes to embed backdoors, biases, or malicious behaviors in the model.")

    static let LLM05 = StandardReference(
        id: "LLM05", framework: "OWASP LLM Top 10 2025", control: "LLM05:2025",
        title: "Improper Output Handling",
        description: "Failure to validate, sanitize, or handle LLM outputs before passing them to downstream systems, enabling injection attacks.")

    static let LLM06 = StandardReference(
        id: "LLM06", framework: "OWASP LLM Top 10 2025", control: "LLM06:2025",
        title: "Excessive Agency",
        description: "LLM-based systems granted excessive functionality, permissions, or autonomy, enabling unintended or harmful actions.")

    static let LLM07 = StandardReference(
        id: "LLM07", framework: "OWASP LLM Top 10 2025", control: "LLM07:2025",
        title: "System Prompt Leakage",
        description: "Extraction or disclosure of system prompts that reveal application logic, security controls, or sensitive configuration.")

    static let LLM08 = StandardReference(
        id: "LLM08", framework: "OWASP LLM Top 10 2025", control: "LLM08:2025",
        title: "Vector and Embedding Weaknesses",
        description: "Vulnerabilities in RAG implementations including poisoned embeddings, retrieval manipulation, and context window attacks.")

    static let LLM09 = StandardReference(
        id: "LLM09", framework: "OWASP LLM Top 10 2025", control: "LLM09:2025",
        title: "Misinformation",
        description: "LLM generates false, misleading, or fabricated information (hallucinations) presented as factual output.")

    static let LLM10 = StandardReference(
        id: "LLM10", framework: "OWASP LLM Top 10 2025", control: "LLM10:2025",
        title: "Unbounded Consumption",
        description: "Denial of service through resource exhaustion via crafted prompts causing excessive compute, memory, or API consumption.")

    // MARK: - OWASP API Security Top 10

    static let API01 = StandardReference(
        id: "API01", framework: "OWASP API Security Top 10 2023", control: "API1:2023",
        title: "Broken Object Level Authorization",
        description: "APIs fail to verify that the requesting user has permission to access the specific object referenced in the request.")

    static let API02 = StandardReference(
        id: "API02", framework: "OWASP API Security Top 10 2023", control: "API2:2023",
        title: "Broken Authentication",
        description: "Weak or missing authentication mechanisms in API endpoints allowing unauthorized access.")

    static let API03 = StandardReference(
        id: "API03", framework: "OWASP API Security Top 10 2023", control: "API3:2023",
        title: "Broken Object Property Level Authorization",
        description: "APIs expose object properties that the user should not be able to read or modify.")

    static let API04 = StandardReference(
        id: "API04", framework: "OWASP API Security Top 10 2023", control: "API4:2023",
        title: "Unrestricted Resource Consumption",
        description: "APIs do not limit the size or number of resources that can be requested, enabling DoS attacks.")

    static let API05 = StandardReference(
        id: "API05", framework: "OWASP API Security Top 10 2023", control: "API5:2023",
        title: "Broken Function Level Authorization",
        description: "APIs fail to restrict access to administrative functions, allowing privilege escalation.")

    static let API08 = StandardReference(
        id: "API08", framework: "OWASP API Security Top 10 2023", control: "API8:2023",
        title: "Security Misconfiguration",
        description: "Insecure default configurations, incomplete configurations, open cloud storage, unnecessary HTTP methods, or verbose error messages.")

    // MARK: - CWE (Common Weakness Enumeration)

    static let CWE_1427 = StandardReference(
        id: "CWE-1427", framework: "CWE", control: "CWE-1427",
        title: "Improper Neutralization of Input Used for LLM Prompting",
        description: "Failure to sanitize inputs that influence LLM prompt construction, enabling prompt injection attacks.")

    static let CWE_284 = StandardReference(
        id: "CWE-284", framework: "CWE", control: "CWE-284",
        title: "Improper Access Control",
        description: "Software does not restrict or incorrectly restricts access to a resource from an unauthorized actor.")

    static let CWE_287 = StandardReference(
        id: "CWE-287", framework: "CWE", control: "CWE-287",
        title: "Improper Authentication",
        description: "Software does not sufficiently verify that the claimed identity of an actor is correct.")

    static let CWE_862 = StandardReference(
        id: "CWE-862", framework: "CWE", control: "CWE-862",
        title: "Missing Authorization",
        description: "Software does not perform an authorization check when an actor attempts to access a resource.")

    static let CWE_918 = StandardReference(
        id: "CWE-918", framework: "CWE", control: "CWE-918",
        title: "Server-Side Request Forgery (SSRF)",
        description: "Application fetches a remote resource based on user-supplied URL without validating the destination.")

    static let CWE_89 = StandardReference(
        id: "CWE-89", framework: "CWE", control: "CWE-89",
        title: "SQL Injection",
        description: "Construction of SQL commands using externally-influenced input without proper neutralization of special elements.")

    static let CWE_79 = StandardReference(
        id: "CWE-79", framework: "CWE", control: "CWE-79",
        title: "Cross-site Scripting (XSS)",
        description: "Software does not neutralize user-controllable input before placing it in output used as a web page served to other users.")

    static let CWE_770 = StandardReference(
        id: "CWE-770", framework: "CWE", control: "CWE-770",
        title: "Allocation of Resources Without Limits or Throttling",
        description: "Software allocates a reusable resource without imposing any restriction on the size or number of resources that can be allocated.")

    static let CWE_352 = StandardReference(
        id: "CWE-352", framework: "CWE", control: "CWE-352",
        title: "Cross-Site Request Forgery (CSRF)",
        description: "Web application does not sufficiently verify that a request was intentionally made by the user who submitted it.")

    static let CWE_346 = StandardReference(
        id: "CWE-346", framework: "CWE", control: "CWE-346",
        title: "Origin Validation Error",
        description: "Software does not properly verify that the source of data or communication is valid.")

    static let CWE_345 = StandardReference(
        id: "CWE-345", framework: "CWE", control: "CWE-345",
        title: "Insufficient Verification of Data Authenticity",
        description: "Software does not sufficiently verify the origin or authenticity of data leading to acceptance of invalid data.")

    static let CWE_522 = StandardReference(
        id: "CWE-522", framework: "CWE", control: "CWE-522",
        title: "Insufficiently Protected Credentials",
        description: "Product transmits or stores authentication credentials but uses an insecure method susceptible to unauthorized interception.")

    static let CWE_613 = StandardReference(
        id: "CWE-613", framework: "CWE", control: "CWE-613",
        title: "Insufficient Session Expiration",
        description: "Application session does not expire or is not invalidated after a given period of inactivity or absolute lifetime.")

    static let CWE_94 = StandardReference(
        id: "CWE-94", framework: "CWE", control: "CWE-94",
        title: "Improper Control of Generation of Code",
        description: "Software constructs all or part of a code segment using externally-influenced input without proper neutralization.")

    static let CWE_78 = StandardReference(
        id: "CWE-78", framework: "CWE", control: "CWE-78",
        title: "OS Command Injection",
        description: "Construction of OS commands using externally-influenced input without proper neutralization of special elements.")

    static let CWE_611 = StandardReference(
        id: "CWE-611", framework: "CWE", control: "CWE-611",
        title: "Improper Restriction of XML External Entity Reference",
        description: "Software processes XML documents that can contain references to external entities causing information disclosure or DoS.")

    static let CWE_502 = StandardReference(
        id: "CWE-502", framework: "CWE", control: "CWE-502",
        title: "Deserialization of Untrusted Data",
        description: "Application deserializes untrusted data without sufficient verification that the data is valid, enabling code execution.")

    // MARK: - MITRE ATLAS

    static let AML_T0051 = StandardReference(
        id: "AML-T0051", framework: "MITRE ATLAS", control: "AML.T0051",
        title: "LLM Prompt Injection",
        description: "Adversarial manipulation of LLM inputs to alter model behavior, bypass safety controls, or extract information.")

    static let AML_T0054 = StandardReference(
        id: "AML-T0054", framework: "MITRE ATLAS", control: "AML.T0054",
        title: "LLM Jailbreak",
        description: "Techniques to bypass LLM safety guardrails and alignment to produce harmful, restricted, or policy-violating outputs.")

    static let AML_T0043 = StandardReference(
        id: "AML-T0043", framework: "MITRE ATLAS", control: "AML.T0043",
        title: "Craft Adversarial Data",
        description: "Creation of specially crafted inputs designed to cause ML models to make incorrect predictions or classifications.")

    static let AML_T0040 = StandardReference(
        id: "AML-T0040", framework: "MITRE ATLAS", control: "AML.T0040",
        title: "ML Model Inference API Access",
        description: "Gaining access to ML model inference APIs to probe model behavior, extract information, or launch attacks.")

    // MARK: - NIST SP 800-53

    static let SI_10 = StandardReference(
        id: "SI-10", framework: "NIST SP 800-53", control: "SI-10",
        title: "Information Input Validation",
        description: "Check information inputs for accuracy, completeness, validity, and authenticity before processing.")

    static let AC_3 = StandardReference(
        id: "AC-3", framework: "NIST SP 800-53", control: "AC-3",
        title: "Access Enforcement",
        description: "Enforce approved authorizations for logical access to information and system resources in accordance with applicable policy.")

    static let AC_4 = StandardReference(
        id: "AC-4", framework: "NIST SP 800-53", control: "AC-4",
        title: "Information Flow Enforcement",
        description: "Enforce approved authorizations for controlling the flow of information within the system and between systems.")

    static let AC_6 = StandardReference(
        id: "AC-6", framework: "NIST SP 800-53", control: "AC-6",
        title: "Least Privilege",
        description: "Employ the principle of least privilege, allowing only authorized accesses necessary for users to accomplish assigned tasks.")

    static let AC_17 = StandardReference(
        id: "AC-17", framework: "NIST SP 800-53", control: "AC-17",
        title: "Remote Access",
        description: "Establish usage restrictions, configuration requirements, and implementation guidance for remote access.")

    static let IA_2 = StandardReference(
        id: "IA-2", framework: "NIST SP 800-53", control: "IA-2",
        title: "Identification and Authentication",
        description: "Uniquely identify and authenticate organizational users, processes, or devices before granting system access.")

    static let IA_5 = StandardReference(
        id: "IA-5", framework: "NIST SP 800-53", control: "IA-5",
        title: "Authenticator Management",
        description: "Manage system authenticators including password policies, PKI certificates, token management, and biometric data.")

    static let IA_8 = StandardReference(
        id: "IA-8", framework: "NIST SP 800-53", control: "IA-8",
        title: "Identification and Authentication (Non-Organizational Users)",
        description: "Identify and authenticate non-organizational users accessing organizational information systems.")

    static let IA_9 = StandardReference(
        id: "IA-9", framework: "NIST SP 800-53", control: "IA-9",
        title: "Service Identification and Authentication",
        description: "Identify and authenticate services before establishing communications with the service.")

    static let SC_7 = StandardReference(
        id: "SC-7", framework: "NIST SP 800-53", control: "SC-7",
        title: "Boundary Protection",
        description: "Monitor and control communications at the external managed interfaces including proxy servers, gateways, and firewalls.")

    static let SC_8 = StandardReference(
        id: "SC-8", framework: "NIST SP 800-53", control: "SC-8",
        title: "Transmission Confidentiality and Integrity",
        description: "Protect the confidentiality and integrity of transmitted information using cryptographic mechanisms.")

    static let SC_12 = StandardReference(
        id: "SC-12", framework: "NIST SP 800-53", control: "SC-12",
        title: "Cryptographic Key Establishment and Management",
        description: "Establish and manage cryptographic keys used in cryptographic mechanisms employed within the system.")

    static let SC_13 = StandardReference(
        id: "SC-13", framework: "NIST SP 800-53", control: "SC-13",
        title: "Cryptographic Protection",
        description: "Determine required cryptographic protections and implement cryptography in accordance with applicable standards.")

    static let SC_23 = StandardReference(
        id: "SC-23", framework: "NIST SP 800-53", control: "SC-23",
        title: "Session Authenticity",
        description: "Protect the authenticity of communications sessions to prevent man-in-the-middle and session hijacking attacks.")

    static let CM_8 = StandardReference(
        id: "CM-8", framework: "NIST SP 800-53", control: "CM-8",
        title: "System Component Inventory",
        description: "Develop and document an inventory of system components that accurately reflects the system and is maintained.")

    static let AU_2 = StandardReference(
        id: "AU-2", framework: "NIST SP 800-53", control: "AU-2",
        title: "Event Logging",
        description: "Identify events requiring logging, frequency, and where logs are stored to support after-the-fact investigations.")

    static let AU_3 = StandardReference(
        id: "AU-3", framework: "NIST SP 800-53", control: "AU-3",
        title: "Content of Audit Records",
        description: "Audit records contain sufficient information to establish what occurred, when, where, source, outcome, and identity.")

    static let AU_6 = StandardReference(
        id: "AU-6", framework: "NIST SP 800-53", control: "AU-6",
        title: "Audit Record Review, Analysis, and Reporting",
        description: "Review and analyze system audit records for indications of inappropriate or unusual activity.")

    static let AU_9 = StandardReference(
        id: "AU-9", framework: "NIST SP 800-53", control: "AU-9",
        title: "Protection of Audit Information",
        description: "Protect audit information and audit logging tools from unauthorized access, modification, and deletion.")

    static let SA_12 = StandardReference(
        id: "SA-12", framework: "NIST SP 800-53", control: "SA-12",
        title: "Supply Chain Protection",
        description: "Protect against supply chain threats by employing security safeguards throughout the system development life cycle.")

    static let SI_4 = StandardReference(
        id: "SI-4", framework: "NIST SP 800-53", control: "SI-4",
        title: "System Monitoring",
        description: "Monitor the system to detect attacks, indicators of potential attacks, and unauthorized connections.")

    // MARK: - ISO 27001:2022

    static let A_8_9 = StandardReference(
        id: "A.8.9", framework: "ISO 27001:2022", control: "A.8.9",
        title: "Configuration Management",
        description: "Configurations of hardware, software, services, and networks shall be established, documented, implemented, monitored, and reviewed.")

    static let A_8_26 = StandardReference(
        id: "A.8.26", framework: "ISO 27001:2022", control: "A.8.26",
        title: "Application Security Requirements",
        description: "Information security requirements shall be identified, specified, and approved when developing or acquiring applications.")

    static let A_5_23 = StandardReference(
        id: "A.5.23", framework: "ISO 27001:2022", control: "A.5.23",
        title: "Information Security for Use of Cloud Services",
        description: "Processes for acquisition, use, management, and exit from cloud services shall be established.")

    static let A_8_24 = StandardReference(
        id: "A.8.24", framework: "ISO 27001:2022", control: "A.8.24",
        title: "Use of Cryptography",
        description: "Rules for the effective use of cryptography including key management shall be defined and implemented.")

    // MARK: - OWASP WSTG (Web Security Testing Guide)

    static let WSTG_INPV_01 = StandardReference(
        id: "WSTG-INPV-01", framework: "OWASP WSTG", control: "WSTG-INPV-01",
        title: "Testing for Reflected Cross-Site Scripting",
        description: "Test for reflected XSS by injecting scripts into parameters that are reflected in the response.")

    static let WSTG_ATHZ_02 = StandardReference(
        id: "WSTG-ATHZ-02", framework: "OWASP WSTG", control: "WSTG-ATHZ-02",
        title: "Testing for Bypassing Authorization Schema",
        description: "Test whether it is possible to bypass the authorization schema by manipulating requests.")

    static let WSTG_ATHN_07 = StandardReference(
        id: "WSTG-ATHN-07", framework: "OWASP WSTG", control: "WSTG-ATHN-07",
        title: "Testing for Weak Password Policy",
        description: "Determine the resistance of the application against brute force password guessing using available password dictionaries.")

    static let WSTG_SESS_01 = StandardReference(
        id: "WSTG-SESS-01", framework: "OWASP WSTG", control: "WSTG-SESS-01",
        title: "Testing for Session Management Schema",
        description: "Test the session management schema including token generation, cookie attributes, and session lifecycle.")

    static let WSTG_CONF_05 = StandardReference(
        id: "WSTG-CONF-05", framework: "OWASP WSTG", control: "WSTG-CONF-05",
        title: "Enumerate Infrastructure and Application Admin Interfaces",
        description: "Identify hidden or unprotected administrative interfaces that could provide elevated access.")
}
