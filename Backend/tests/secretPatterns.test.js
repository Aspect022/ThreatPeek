/**
 * Comprehensive unit tests for new secret detection patterns
 * Tests accuracy and false positive prevention for all new patterns
 */

const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const { secretPatterns } = require('../utils/enhancedPatternDefinitions');

describe('Secret Pattern Detection', () => {
    let engine;

    beforeEach(() => {
        engine = new EnhancedPatternEngine();
        engine.registerPatterns(secretPatterns);
    });

    describe('Twilio API Key Detection (Requirement 1.1)', () => {
        test('should detect valid Twilio API keys', () => {
            const validKeys = [
                'SK1234567890abcdef1234567890abcdef',
                'SKabcdef1234567890abcdef1234567890',
                'SK0123456789abcdef0123456789abcdef'
            ];

            validKeys.forEach(key => {
                const content = `const TWILIO_API_KEY = "${key}";`;
                const matches = engine.scanContent(content);
                const twilioMatches = matches.filter(m => m.pattern.id === 'twilio-api-key');

                expect(twilioMatches.length).toBeGreaterThan(0);
                expect(twilioMatches[0].value).toBe(key);
                expect(twilioMatches[0].confidence).toBeGreaterThan(0.7);
            });
        });

        test('should detect valid Twilio Auth Tokens', () => {
            const validTokens = [
                'AC1234567890abcdef1234567890abcdef',
                'ACabcdef1234567890abcdef1234567890',
                'AC0123456789abcdef0123456789abcdef'
            ];

            validTokens.forEach(token => {
                const content = `TWILIO_AUTH_TOKEN = "${token}";`;
                const matches = engine.scanContent(content);
                const twilioMatches = matches.filter(m => m.pattern.id === 'twilio-auth-token');

                expect(twilioMatches.length).toBeGreaterThan(0);
                expect(twilioMatches[0].value).toBe(token);
                expect(twilioMatches[0].confidence).toBeGreaterThan(0.7);
            });
        });

        test('should reject invalid Twilio patterns', () => {
            const invalidKeys = [
                'SK123456789', // Too short
                'SK1234567890abcdef1234567890abcdefg', // Too long
                'TK1234567890abcdef1234567890abcdef', // Wrong prefix
                'AC123456789', // Auth token too short
                'AC1234567890abcdef1234567890abcdefg' // Auth token too long
            ];

            invalidKeys.forEach(key => {
                const content = `const key = "${key}";`;
                const matches = engine.scanContent(content);
                const twilioMatches = matches.filter(m =>
                    m.pattern.id === 'twilio-api-key' || m.pattern.id === 'twilio-auth-token'
                );

                expect(twilioMatches.length).toBe(0);
            });
        });

        test('should filter false positives', () => {
            const falsePositives = [
                'example SK1234567890abcdef1234567890abcdef',
                'test AC1234567890abcdef1234567890abcdef',
                '// Example: SK1234567890abcdef1234567890abcdef'
            ];

            falsePositives.forEach(content => {
                const matches = engine.scanContent(content);
                const twilioMatches = matches.filter(m =>
                    m.pattern.id === 'twilio-api-key' || m.pattern.id === 'twilio-auth-token'
                );

                expect(twilioMatches.length).toBe(0);
            });
        });
    });

    describe('Azure Service Detection (Requirement 1.2)', () => {
        test('should detect Azure storage connection strings', () => {
            const validConnections = [
                'DefaultEndpointsProtocol=https;AccountName=prodstorage;AccountKey=abcdef123456==',
                'DefaultEndpointsProtocol=https;AccountName=livesystem;AccountKey=xyz789+/==',
                'DefaultEndpointsProtocol=https;AccountName=prod123;AccountKey=longkey123456789=='
            ];

            validConnections.forEach(connection => {
                const content = `const connectionString = "${connection}";`;
                const matches = engine.scanContent(content);
                const azureMatches = matches.filter(m => m.pattern.id === 'azure-storage-connection');

                expect(azureMatches.length).toBeGreaterThan(0);
                expect(azureMatches[0].value).toBe(connection);
                expect(azureMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should detect Azure service principal keys', () => {
            const validKeys = [
                'abcdef1234567890abcdef1234567890abcd',
                'xyz789-abcd-1234-5678-abcdef123456',
                'longkey~1234567890abcdef1234567890'
            ];

            validKeys.forEach(key => {
                const content = `AZURE_CLIENT_SECRET = "${key}";`;
                const matches = engine.scanContent(content);
                const azureMatches = matches.filter(m => m.pattern.id === 'azure-service-principal');

                expect(azureMatches.length).toBeGreaterThan(0);
                expect(azureMatches[0].value).toBe(key);
                expect(azureMatches[0].confidence).toBeGreaterThan(0.6);
            });
        });

        test('should filter Azure false positives', () => {
            const falsePositives = [
                'example DefaultEndpointsProtocol=https;AccountName=example;AccountKey=placeholder',
                'placeholder AZURE_CLIENT_SECRET',
                'your_account DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=key'
            ];

            falsePositives.forEach(content => {
                const matches = engine.scanContent(content);
                const azureMatches = matches.filter(m =>
                    m.pattern.id === 'azure-storage-connection' || m.pattern.id === 'azure-service-principal'
                );

                expect(azureMatches.length).toBe(0);
            });
        });
    });

    describe('SendGrid API Key Detection (Requirement 1.3)', () => {
        test('should detect valid SendGrid API keys', () => {
            const validKeys = [
                'SG.1234567890abcdef123456.abcdef1234567890abcdef1234567890abcdef12345',
                'SG.abcdef-1234567890_12345.xyz789_abcdef1234567890-abcdef1234567890abc',
                'SG.live_key_1234567890abc.production_key_1234567890abcdef1234567890ab'
            ];

            validKeys.forEach(key => {
                const content = `SENDGRID_API_KEY = "${key}";`;
                const matches = engine.scanContent(content);
                const sendgridMatches = matches.filter(m => m.pattern.id === 'sendgrid-api-key');

                expect(sendgridMatches.length).toBeGreaterThan(0);
                expect(sendgridMatches[0].value).toBe(key);
                expect(sendgridMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should reject invalid SendGrid patterns', () => {
            const invalidKeys = [
                'SG.123456789012345678901.123456789012345678901234567890123456789012', // Wrong segment lengths
                'TG.1234567890abcdef123456.abcdef1234567890abcdef1234567890abcdef123456', // Wrong prefix
                'SG.short.toolong1234567890abcdef1234567890abcdef123456', // Wrong lengths
                'SG.1234567890abcdef123456' // Missing second part
            ];

            invalidKeys.forEach(key => {
                const content = `const key = "${key}";`;
                const matches = engine.scanContent(content);
                const sendgridMatches = matches.filter(m => m.pattern.id === 'sendgrid-api-key');

                expect(sendgridMatches.length).toBe(0);
            });
        });

        test('should filter SendGrid false positives', () => {
            const falsePositives = [
                'example SG.1234567890abcdef123456.abcdef1234567890abcdef1234567890abcdef123456',
                'test SG.1234567890abcdef123456.abcdef1234567890abcdef1234567890abcdef123456'
            ];

            falsePositives.forEach(content => {
                const matches = engine.scanContent(content);
                const sendgridMatches = matches.filter(m => m.pattern.id === 'sendgrid-api-key');

                expect(sendgridMatches.length).toBe(0);
            });
        });
    });

    describe('GitHub Token Detection (Requirement 1.4)', () => {
        test('should detect GitHub fine-grained tokens', () => {
            const validTokens = [
                'github_pat_1234567890abcdef123456_12345678901234567890123456789012345678901234567890123456789',
                'github_pat_abcdefABCDEF1234567890_1234567890abcdefABCDEF1234567890abcdefABCDEF123456789012345'
            ];

            validTokens.forEach(token => {
                const content = `const token = "${token}";`;
                const matches = engine.scanContent(content);
                const githubMatches = matches.filter(m => m.pattern.id === 'github-fine-grained-token');

                expect(githubMatches.length).toBeGreaterThan(0);
                expect(githubMatches[0].value).toBe(token);
                expect(githubMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should detect GitHub App installation tokens', () => {
            const validTokens = [
                'ghs_1234567890abcdefABCDEF1234567890abcd',
                'ghs_abcdefABCDEF1234567890abcdefABCDEF12'
            ];

            validTokens.forEach(token => {
                const content = `GITHUB_APP_TOKEN = "${token}";`;
                const matches = engine.scanContent(content);
                const githubMatches = matches.filter(m => m.pattern.id === 'github-app-token');

                expect(githubMatches.length).toBeGreaterThan(0);
                expect(githubMatches[0].value).toBe(token);
                expect(githubMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should reject invalid GitHub patterns', () => {
            const invalidTokens = [
                'github_pat_short_short', // Too short
                'github_token_1234567890abcdef123456_abcdef1234567890abcdef1234567890abcdef1234567890abcde', // Wrong prefix
                'ghs_short', // App token too short
                'ghp_1234567890abcdefABCDEF1234567890abcd' // Wrong app token prefix
            ];

            invalidTokens.forEach(token => {
                const content = `const token = "${token}";`;
                const matches = engine.scanContent(content);
                const githubMatches = matches.filter(m =>
                    m.pattern.id === 'github-fine-grained-token' || m.pattern.id === 'github-app-token'
                );

                expect(githubMatches.length).toBe(0);
            });
        });

        test('should filter GitHub false positives', () => {
            const falsePositives = [
                'example github_pat_1234567890abcdef123456_abcdef1234567890abcdef1234567890abcdef1234567890abcde',
                'placeholder ghs_1234567890abcdefABCDEF1234567890abcd'
            ];

            falsePositives.forEach(content => {
                const matches = engine.scanContent(content);
                const githubMatches = matches.filter(m =>
                    m.pattern.id === 'github-fine-grained-token' || m.pattern.id === 'github-app-token'
                );

                expect(githubMatches.length).toBe(0);
            });
        });
    });

    describe('Stripe Key Detection (Requirement 1.5)', () => {
        test('should detect Stripe publishable keys', () => {
            const validKeys = [
                'pk_live_1234567890abcdef1234567890abcdef',
                'pk_live_abcdefABCDEF1234567890abcdefABCDEF1234',
                'pk_live_longkey1234567890abcdefABCDEF1234567890abcdef'
            ];

            validKeys.forEach(key => {
                const content = `const publishableKey = "${key}";`;
                const matches = engine.scanContent(content);
                const stripeMatches = matches.filter(m => m.pattern.id === 'stripe-publishable-key');

                expect(stripeMatches.length).toBeGreaterThan(0);
                expect(stripeMatches[0].value).toBe(key);
                expect(stripeMatches[0].confidence).toBeGreaterThan(0.6);
            });
        });

        test('should detect Stripe webhook secrets', () => {
            const validSecrets = [
                'whsec_1234567890abcdefABCDEF1234567890',
                'whsec_abcdefABCDEF1234567890abcdefABCDEF1234567890'
            ];

            validSecrets.forEach(secret => {
                const content = `STRIPE_WEBHOOK_SECRET = "${secret}";`;
                const matches = engine.scanContent(content);
                const stripeMatches = matches.filter(m => m.pattern.id === 'stripe-webhook-secret');

                expect(stripeMatches.length).toBeGreaterThan(0);
                expect(stripeMatches[0].value).toBe(secret);
                expect(stripeMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should detect enhanced Stripe secret keys', () => {
            const validKeys = [
                'sk_live_1234567890abcdef1234567890abcdef',
                'sk_live_abcdefABCDEF1234567890abcdefABCDEF1234'
            ];

            validKeys.forEach(key => {
                const content = `STRIPE_SECRET_KEY = "${key}";`;
                const matches = engine.scanContent(content);
                const stripeMatches = matches.filter(m => m.pattern.id === 'stripe-secret-key');

                expect(stripeMatches.length).toBeGreaterThan(0);
                expect(stripeMatches[0].value).toBe(key);
                expect(stripeMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should reject invalid Stripe patterns', () => {
            const invalidKeys = [
                'pk_prod_1234567890abcdef1234567890abcdef', // Wrong environment
                'pk_test_short', // Too short
                'sk_demo_1234567890abcdef1234567890abcdef', // Wrong environment for secret
                'whsec_short' // Webhook secret too short
            ];

            invalidKeys.forEach(key => {
                const content = `const key = "${key}";`;
                const matches = engine.scanContent(content);
                const stripeMatches = matches.filter(m =>
                    m.pattern.id === 'stripe-publishable-key' ||
                    m.pattern.id === 'stripe-webhook-secret' ||
                    m.pattern.id === 'stripe-secret-key'
                );

                expect(stripeMatches.length).toBe(0);
            });
        });

        test('should filter Stripe false positives', () => {
            const falsePositives = [
                'example pk_test_1234567890abcdef1234567890abcdef',
                'placeholder whsec_1234567890abcdefABCDEF1234567890'
            ];

            falsePositives.forEach(content => {
                const matches = engine.scanContent(content);
                const stripeMatches = matches.filter(m =>
                    m.pattern.id === 'stripe-publishable-key' ||
                    m.pattern.id === 'stripe-webhook-secret' ||
                    m.pattern.id === 'stripe-secret-key'
                );

                expect(stripeMatches.length).toBe(0);
            });
        });
    });

    describe('Additional Service Provider Patterns (Requirement 1.6)', () => {
        test('should detect Discord bot tokens', () => {
            const validTokens = [
                'MTA1234567890abcdef12345.GhIjKl.abcdef1234567890abcdef12345',
                'NjA1234567890abcdef12345.XyZabc.abcdef1234567890abcdef12345',
                'mfa.MTA1234567890abcdef12345.GhIjKl.abcdef1234567890abcdef12345'
            ];

            validTokens.forEach(token => {
                const content = `const discordToken = "${token}";`;
                const matches = engine.scanContent(content);
                const discordMatches = matches.filter(m => m.pattern.id === 'discord-bot-token');

                expect(discordMatches.length).toBeGreaterThan(0);
                expect(discordMatches[0].value).toBe(token);
                expect(discordMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should detect Notion API keys', () => {
            const validKeys = [
                'secret_1234567890abcdefABCDEF1234567890abcdef12345',
                'secret_abcdefABCDEF1234567890abcdefABCDEF123456789'
            ];

            validKeys.forEach(key => {
                const content = `const notionKey = "${key}";`;
                const matches = engine.scanContent(content);
                const notionMatches = matches.filter(m => m.pattern.id === 'notion-api-key');

                expect(notionMatches.length).toBeGreaterThan(0);
                expect(notionMatches[0].value).toBe(key);
                expect(notionMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should detect DigitalOcean tokens', () => {
            const validTokens = [
                'dop_v1_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                'dop_v1_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
            ];

            validTokens.forEach(token => {
                const content = `DIGITALOCEAN_TOKEN = "${token}";`;
                const matches = engine.scanContent(content);
                const doMatches = matches.filter(m => m.pattern.id === 'digitalocean-token');

                expect(doMatches.length).toBeGreaterThan(0);
                expect(doMatches[0].value).toBe(token);
                expect(doMatches[0].confidence).toBeGreaterThan(0.8);
            });
        });

        test('should reject invalid additional service patterns', () => {
            const invalidTokens = [
                'XTA1234567890abcdef123456.GhIjKl.abcdef1234567890abcdef123456789', // Wrong Discord prefix
                'secret_short', // Notion key too short
                'dop_v2_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Wrong DO version
                'MTA123.Gh.abc' // Discord token segments too short
            ];

            invalidTokens.forEach(token => {
                const content = `const token = "${token}";`;
                const matches = engine.scanContent(content);
                const serviceMatches = matches.filter(m =>
                    m.pattern.id === 'discord-bot-token' ||
                    m.pattern.id === 'notion-api-key' ||
                    m.pattern.id === 'digitalocean-token'
                );

                expect(serviceMatches.length).toBe(0);
            });
        });

        test('should filter additional service false positives', () => {
            const falsePositives = [
                'example MTA1234567890abcdef123456.GhIjKl.abcdef1234567890abcdef123456789',
                'placeholder secret_1234567890abcdefABCDEF1234567890abcdef123',
                'example dop_v1_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
            ];

            falsePositives.forEach(content => {
                const matches = engine.scanContent(content);
                const serviceMatches = matches.filter(m =>
                    m.pattern.id === 'discord-bot-token' ||
                    m.pattern.id === 'notion-api-key' ||
                    m.pattern.id === 'digitalocean-token'
                );

                expect(serviceMatches.length).toBe(0);
            });
        });
    });

    describe('Context-Aware Validation', () => {
        test('should boost confidence for proper variable naming', () => {
            const content1 = 'const TWILIO_API_KEY = "SK1234567890abcdef1234567890abcdef";';
            const content2 = 'SK1234567890abcdef1234567890abcdef';

            const matches1 = engine.scanContent(content1);
            const matches2 = engine.scanContent(content2);

            const twilioMatch1 = matches1.find(m => m.pattern.id === 'twilio-api-key');
            const twilioMatch2 = matches2.find(m => m.pattern.id === 'twilio-api-key');

            expect(twilioMatch1).toBeDefined();
            expect(twilioMatch2).toBeDefined();
            expect(twilioMatch1.confidence).toBeGreaterThan(twilioMatch2.confidence);
        });

        test('should boost confidence for environment variable context', () => {
            const content1 = 'process.env.SENDGRID_API_KEY = "SG.1234567890abcdef123456.abcdef1234567890abcdef1234567890abcdef123456";';
            const content2 = 'SG.1234567890abcdef123456.abcdef1234567890abcdef1234567890abcdef123456';

            const matches1 = engine.scanContent(content1);
            const matches2 = engine.scanContent(content2);

            const sendgridMatch1 = matches1.find(m => m.pattern.id === 'sendgrid-api-key');
            const sendgridMatch2 = matches2.find(m => m.pattern.id === 'sendgrid-api-key');

            expect(sendgridMatch1).toBeDefined();
            expect(sendgridMatch2).toBeDefined();
            expect(sendgridMatch1.confidence).toBeGreaterThan(sendgridMatch2.confidence);
        });
    });

    describe('Performance with Multiple Patterns', () => {
        test('should efficiently scan content with multiple secret types', () => {
            const mixedContent = `
                const TWILIO_API_KEY = "SK1234567890abcdef1234567890abcdef";
                const AZURE_CONNECTION = "DefaultEndpointsProtocol=https;AccountName=prodstorage;AccountKey=abc123==";
                const SENDGRID_KEY = "SG.1234567890abcdef123456.abcdef1234567890abcdef1234567890abcdef123456";
                const GITHUB_TOKEN = "github_pat_1234567890abcdef123456_12345678901234567890123456789012345678901234567890123456789";
                const STRIPE_KEY = "pk_live_1234567890abcdef1234567890abcdef";
                const DISCORD_TOKEN = "MTA1234567890abcdef12345.GhIjKl.abcdef1234567890abcdef12345";
            `;

            const startTime = Date.now();
            const matches = engine.scanContent(mixedContent);
            const endTime = Date.now();

            expect(matches.length).toBeGreaterThanOrEqual(6);
            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms

            // Verify each pattern type is detected
            const patternIds = matches.map(m => m.pattern.id);
            expect(patternIds).toContain('twilio-api-key');
            expect(patternIds).toContain('azure-storage-connection');
            expect(patternIds).toContain('sendgrid-api-key');
            expect(patternIds).toContain('github-fine-grained-token');
            expect(patternIds).toContain('stripe-publishable-key');
            expect(patternIds).toContain('discord-bot-token');
        });
    });
});