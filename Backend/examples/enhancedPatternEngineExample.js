/**
 * Example usage of the Enhanced Pattern Engine
 * Demonstrates how to use the pattern engine with different configurations
 */

const { PatternEngineFactory } = require('../utils/patternEngineFactory');

// Example 1: Create a full engine with all patterns
console.log('=== Example 1: Full Engine ===');
const fullEngine = PatternEngineFactory.createFullEngine({
    confidenceThreshold: 0.7,
    contextAnalysisEnabled: true
});

const testContent = `
const config = {
  openaiKey: "sk-1234567890abcdef1234567890abcdef1234567890abcdef",
  stripeKey: "sk_live_1234567890abcdef1234567890abcdef",
  twilioKey: "SK1234567890abcdef1234567890abcdef",
  database: "postgresql://user:password123@localhost:5432/db"
};
`;

const matches = fullEngine.scanContent(testContent);
console.log(`Found ${matches.length} matches:`);
matches.forEach(match => {
    console.log(`- ${match.pattern.name}: ${match.value} (confidence: ${match.confidence.toFixed(2)})`);
});

// Example 2: Create a secrets-only engine
console.log('\n=== Example 2: Secrets Only Engine ===');
const secretsEngine = PatternEngineFactory.createSecretsEngine({
    confidenceThreshold: 0.8
});

const secretMatches = secretsEngine.scanContent(testContent);
console.log(`Found ${secretMatches.length} secret matches:`);
secretMatches.forEach(match => {
    console.log(`- ${match.pattern.name}: ${match.value} (confidence: ${match.confidence.toFixed(2)})`);
});

// Example 3: Create a lightweight engine for performance
console.log('\n=== Example 3: Lightweight Engine ===');
const lightweightEngine = PatternEngineFactory.createLightweightEngine();

const lightMatches = lightweightEngine.scanContent(testContent);
console.log(`Found ${lightMatches.length} high-confidence matches:`);
lightMatches.forEach(match => {
    console.log(`- ${match.pattern.name}: ${match.value} (confidence: ${match.confidence.toFixed(2)})`);
});

// Example 4: Custom engine with specific patterns
console.log('\n=== Example 4: Custom Engine ===');
const customEngine = PatternEngineFactory.createCustomEngine([
    'openai-api-key',
    'stripe-secret-key',
    'aws-access-key'
]);

const customMatches = customEngine.scanContent(testContent);
console.log(`Found ${customMatches.length} custom pattern matches:`);
customMatches.forEach(match => {
    console.log(`- ${match.pattern.name}: ${match.value} (confidence: ${match.confidence.toFixed(2)})`);
});

// Example 5: Get available patterns information
console.log('\n=== Example 5: Available Patterns ===');
const patternsInfo = PatternEngineFactory.getAvailablePatterns();
console.log(`Total patterns available: ${patternsInfo.total}`);
console.log('Categories:');
Object.entries(patternsInfo.categories).forEach(([category, count]) => {
    console.log(`- ${category}: ${count} patterns`);
});

// Example 6: Configuration validation
console.log('\n=== Example 6: Configuration Validation ===');
const validConfig = { confidenceThreshold: 0.8, categories: ['secrets'] };
const invalidConfig = { confidenceThreshold: 1.5, categories: ['invalid'] };

const validResult = PatternEngineFactory.validateConfig(validConfig);
const invalidResult = PatternEngineFactory.validateConfig(invalidConfig);

console.log('Valid config result:', validResult);
console.log('Invalid config result:', invalidResult);