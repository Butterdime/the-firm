# Google Code Assistant Prompt: Individual Entity Recognition for ABN Search

## Context
You are tasked with developing code that handles individual entity recognition for Australian Business Number (ABN) website searches, where individuals can incorporate entities under their own names.

## Objective
Create a solution that recognizes when an individual has incorporated an entity under their personal name, ensuring proper matching of full name and address postcode data from ABN website search results.

## Requirements

### Core Functionality
- **Individual Entity Detection**: Implement logic to identify when a person has registered a business entity using their personal name
- **Name Matching**: Ensure full name matching between individual records and incorporated entity records
- **Address Validation**: Implement postcode matching to verify address consistency between individual and entity records
- **ABN Integration**: Interface with ABN website search functionality to retrieve and process entity data

### Technical Specifications
- Handle both individual and entity record types from ABN search results
- Implement fuzzy matching algorithms for name variations (middle names, initials, etc.)
- Validate postcode matching with error tolerance for data entry variations
- Return consolidated records showing individual-entity relationships

### Input Parameters
- Individual full name (first, middle, last)
- Address postcode
- ABN search criteria
- Matching confidence threshold

### Expected Output
- Matched entity records linked to individuals
- Confidence scores for name and address matching
- Consolidated view of individual and their incorporated entities
- Validation status and any discrepancies found

## Implementation Guidelines
- Use robust string matching algorithms (Levenshtein distance, soundex, etc.)
- Implement logging for audit trail of matching decisions
- Handle edge cases (common names, multiple entities, address changes)
- Ensure compliance with privacy and data protection requirements

## Success Criteria
- Accurate identification of individual-entity relationships
- Minimal false positives in matching results
- Efficient processing of large datasets
- Clear documentation and error handling

Please implement this functionality with appropriate error handling, testing, and documentation.