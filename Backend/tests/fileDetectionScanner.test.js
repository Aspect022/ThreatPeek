/**
 * Comprehensive unit tests for File Detection Scanner
 * Tests file detection accuracy, HTTP request logic, and content analysis
 * Requirements: 2.1, 2.2, 2.5
 */

const axios = require('axios');
const fileDetectionScanner = require('../services/fileDetectionScanner');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('FileDetectionScanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset axios create mock
        mockedAxios.create = jest.fn(() => ({
            get: jest.fn()
        }));
    });

    describe('scan method', () => {
        test('should scan target URL for exposed sensitive files', async () => {
            const mockHttpClient = {
                get: jest.fn()
            };

            // Mock successful .env file detection
            mockHttpClient.get
                .mockResolvedValueOnce({
                    status: 200,
                    headers: {
                        'content-type': 'text/plain',
                        'content-length': '150'
                    },
                    data: 'API_KEY=sk-test123\nDATABASE_URL=postgres://user:pass@localhost/db'
                })
                .mockRejectedValue({ response: { status: 404 } }); // All other files return 404

            // Replace the scanner's httpClient
            fileDetectionScanner.httpClient = mockHttpClient;

            const target = { value: 'https://example.com' };
            const options = { onProgress: jest.fn() };

            const results = await fileDetectionScanner.scan(target, options);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                type: 'Exposed Sensitive File',
                severity: 'critical',
                value: '.env',
                file: 'https://example.com/.env'
            });
            expect(results[0].confidence).toBeGreaterThan(0.7);
            expect(options.onProgress).toHaveBeenCalled();
        });

        test('should handle progress updates correctly', async () => {
            const mockHttpClient = {
                get: jest.fn().mockRejectedValue({ response: { status: 404 } })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const target = { value: 'https://example.com' };
            const progressCallback = jest.fn();
            const options = { onProgress: progressCallback };

            await fileDetectionScanner.scan(target, options);

            // Should call progress callback multiple times
            expect(progressCallback).toHaveBeenCalledTimes(fileDetectionScanner.sensitiveFiles.length);
            expect(progressCallback).toHaveBeenCalledWith(100); // Final progress should be 100%
        });

        test('should handle scan errors gracefully', async () => {
            const target = { value: 'not-a-valid-url-format' };

            await expect(fileDetectionScanner.scan(target)).rejects.toThrow('File detection scan failed');
        });
    });

    describe('checkFileAccessibility method', () => {
        test('should detect accessible .env file', async () => {
            const mockHttpClient = {
                get: jest.fn().mockResolvedValue({
                    status: 200,
                    headers: {
                        'content-type': 'text/plain',
                        'content-length': '100'
                    },
                    data: 'API_KEY=test123\nDATABASE_URL=localhost'
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.env', '.env');

            expect(result).toBeTruthy();
            expect(result.type).toBe('Exposed Sensitive File');
            expect(result.severity).toBe('critical');
            expect(result.value).toBe('.env');
            expect(result.file).toBe('https://example.com/.env');
            expect(result.metadata.statusCode).toBe(200);
        });

        test('should detect accessible .git/config file', async () => {
            const mockHttpClient = {
                get: jest.fn().mockResolvedValue({
                    status: 200,
                    headers: {
                        'content-type': 'text/plain',
                        'content-length': '200'
                    },
                    data: '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = https://github.com/user/repo.git'
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.git/config', '.git/config');

            expect(result).toBeTruthy();
            expect(result.severity).toBe('high');
            expect(result.value).toBe('.git/config');
        });

        test('should detect accessible .DS_Store file', async () => {
            const mockHttpClient = {
                get: jest.fn().mockResolvedValue({
                    status: 200,
                    headers: {
                        'content-type': 'application/octet-stream',
                        'content-length': '6148'
                    },
                    data: Buffer.from('DS_Store binary data')
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.DS_Store', '.DS_Store');

            expect(result).toBeTruthy();
            expect(result.severity).toBe('medium');
            expect(result.value).toBe('.DS_Store');
        });

        test('should detect accessible config.js file', async () => {
            const mockHttpClient = {
                get: jest.fn().mockResolvedValue({
                    status: 200,
                    headers: {
                        'content-type': 'application/javascript',
                        'content-length': '300'
                    },
                    data: 'module.exports = {\n  apiKey: "sk-test123",\n  database: "mongodb://localhost/app"\n};'
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/config.js', 'config.js');

            expect(result).toBeTruthy();
            expect(result.severity).toBe('high');
            expect(result.value).toBe('config.js');
        });

        test('should detect accessible .htaccess file', async () => {
            const mockHttpClient = {
                get: jest.fn().mockResolvedValue({
                    status: 200,
                    headers: {
                        'content-type': 'text/plain',
                        'content-length': '150'
                    },
                    data: 'RewriteEngine On\nRewriteRule ^(.*)$ index.php [QSA,L]'
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.htaccess', '.htaccess');

            expect(result).toBeTruthy();
            expect(result.severity).toBe('medium');
            expect(result.value).toBe('.htaccess');
        });

        test('should return null for 404 responses', async () => {
            const mockHttpClient = {
                get: jest.fn().mockRejectedValue({
                    response: { status: 404 }
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.env', '.env');

            expect(result).toBeNull();
        });

        test('should return null for error pages', async () => {
            const mockHttpClient = {
                get: jest.fn().mockResolvedValue({
                    status: 200,
                    headers: {
                        'content-type': 'text/html',
                        'content-length': '500'
                    },
                    data: '<html><head><title>404 Not Found</title></head><body>File not found</body></html>'
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.env', '.env');

            expect(result).toBeNull();
        });

        test('should handle network errors gracefully', async () => {
            const mockHttpClient = {
                get: jest.fn().mockRejectedValue(new Error('Network timeout'))
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.env', '.env');

            expect(result).toBeNull();
        });
    });

    describe('analyzeFileContent method', () => {
        test('should detect secrets in .env file content', async () => {
            const content = `
OPENAI_API_KEY=sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
DATABASE_URL=postgres://user:password@localhost:5432/mydb
STRIPE_SECRET_KEY=sk_test_abcdefghijklmnopqrstuvwxyz123456
            `.trim();

            const results = await fileDetectionScanner.analyzeFileContent(content, 'https://example.com/.env', '.env');

            expect(results.length).toBeGreaterThan(0);

            // Should find API key
            const apiKeyFinding = results.find(r => r.value.includes('sk-'));
            expect(apiKeyFinding).toBeTruthy();
            expect(apiKeyFinding.type).toBe('Secret in Configuration File');
            expect(apiKeyFinding.pattern.category).toBe('secrets');
        });

        test('should detect secrets in config.js file content', async () => {
            const content = `
openai_api_key = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef'
stripe_secret_key = 'sk_test_1234567890abcdef1234567890abcdef'
            `.trim();

            const results = await fileDetectionScanner.analyzeFileContent(content, 'https://example.com/config.js', 'config.js');

            expect(results.length).toBeGreaterThan(0);

            // Should include line and column information
            const finding = results[0];
            expect(finding.location).toBeDefined();
            expect(finding.location.line).toBeGreaterThan(0);
            expect(finding.location.column).toBeGreaterThan(0);
        });

        test('should handle content analysis errors gracefully', async () => {
            // Test with invalid content that might cause parsing errors
            const content = null;

            const results = await fileDetectionScanner.analyzeFileContent(content, 'https://example.com/.env', '.env');

            expect(results).toEqual([]);
        });
    });

    describe('isErrorPage method', () => {
        test('should identify 404 error pages', () => {
            const errorContent = '<html><head><title>404 Not Found</title></head><body>Page not found</body></html>';

            const result = fileDetectionScanner.isErrorPage(errorContent, 404);

            expect(result).toBe(true);
        });

        test('should identify nginx error pages', () => {
            const errorContent = '<html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center><hr><center>nginx/1.18.0</center></body></html>';

            const result = fileDetectionScanner.isErrorPage(errorContent, 404);

            expect(result).toBe(true);
        });

        test('should not identify valid content as error page', () => {
            const validContent = 'API_KEY=sk-test123\nDATABASE_URL=localhost';

            const result = fileDetectionScanner.isErrorPage(validContent, 200);

            expect(result).toBe(false);
        });

        test('should handle null/undefined content', () => {
            expect(fileDetectionScanner.isErrorPage(null, 200)).toBe(false);
            expect(fileDetectionScanner.isErrorPage(undefined, 200)).toBe(false);
            expect(fileDetectionScanner.isErrorPage('', 200)).toBe(false);
        });
    });

    describe('isConfigurationFile method', () => {
        test('should identify .env files as configuration files', () => {
            expect(fileDetectionScanner.isConfigurationFile('.env')).toBe(true);
            expect(fileDetectionScanner.isConfigurationFile('.env.local')).toBe(true);
            expect(fileDetectionScanner.isConfigurationFile('.env.production')).toBe(true);
        });

        test('should identify config files as configuration files', () => {
            expect(fileDetectionScanner.isConfigurationFile('config.js')).toBe(true);
            expect(fileDetectionScanner.isConfigurationFile('config.json')).toBe(true);
            expect(fileDetectionScanner.isConfigurationFile('settings.py')).toBe(true);
        });

        test('should identify files by extension', () => {
            expect(fileDetectionScanner.isConfigurationFile('database.yml')).toBe(true);
            expect(fileDetectionScanner.isConfigurationFile('app.config')).toBe(true);
            expect(fileDetectionScanner.isConfigurationFile('local_settings.py')).toBe(true);
        });

        test('should not identify non-config files', () => {
            expect(fileDetectionScanner.isConfigurationFile('.DS_Store')).toBe(false);
            expect(fileDetectionScanner.isConfigurationFile('id_rsa')).toBe(false);
            expect(fileDetectionScanner.isConfigurationFile('.htaccess')).toBe(false);
        });
    });

    describe('calculateFileConfidence method', () => {
        test('should give high confidence for .env files with config content', () => {
            const mockResponse = {
                headers: {
                    'content-type': 'text/plain',
                    'content-length': '100'
                }
            };
            const content = 'API_KEY=test123\nDATABASE_URL=localhost';

            const confidence = fileDetectionScanner.calculateFileConfidence('.env', content, mockResponse);

            expect(confidence).toBeGreaterThan(0.9);
        });

        test('should give lower confidence for empty files', () => {
            const mockResponse = {
                headers: {
                    'content-type': 'text/plain',
                    'content-length': '0'
                }
            };
            const content = '';

            const confidence = fileDetectionScanner.calculateFileConfidence('.env', content, mockResponse);

            expect(confidence).toBeLessThan(0.7);
        });

        test('should adjust confidence based on content type', () => {
            const mockResponse = {
                headers: {
                    'content-type': 'application/json',
                    'content-length': '50'
                }
            };
            const content = '{"apiKey": "test123"}';

            const confidence = fileDetectionScanner.calculateFileConfidence('config.json', content, mockResponse);

            expect(confidence).toBeGreaterThan(0.8);
        });
    });

    describe('getFileSeverity method', () => {
        test('should return critical for sensitive files', () => {
            expect(fileDetectionScanner.getFileSeverity('.env')).toBe('critical');
            expect(fileDetectionScanner.getFileSeverity('id_rsa')).toBe('critical');
            expect(fileDetectionScanner.getFileSeverity('private.key')).toBe('critical');
        });

        test('should return high for config files', () => {
            expect(fileDetectionScanner.getFileSeverity('.git/config')).toBe('high');
            expect(fileDetectionScanner.getFileSeverity('config.js')).toBe('high');
            expect(fileDetectionScanner.getFileSeverity('wp-config.php')).toBe('high');
        });

        test('should return medium for less sensitive files', () => {
            expect(fileDetectionScanner.getFileSeverity('.htaccess')).toBe('medium');
            expect(fileDetectionScanner.getFileSeverity('.DS_Store')).toBe('medium');
            expect(fileDetectionScanner.getFileSeverity('web.config')).toBe('medium');
        });

        test('should return low for unknown files', () => {
            expect(fileDetectionScanner.getFileSeverity('unknown.txt')).toBe('low');
        });
    });

    describe('normalizeUrl method', () => {
        test('should add https protocol if missing', () => {
            const result = fileDetectionScanner.normalizeUrl('example.com');
            expect(result).toBe('https://example.com');
        });

        test('should remove trailing slash', () => {
            const result = fileDetectionScanner.normalizeUrl('https://example.com/');
            expect(result).toBe('https://example.com');
        });

        test('should preserve existing protocol', () => {
            const result = fileDetectionScanner.normalizeUrl('http://example.com');
            expect(result).toBe('http://example.com');
        });

        test('should handle complex URLs', () => {
            const result = fileDetectionScanner.normalizeUrl('https://subdomain.example.com:8080/path/');
            expect(result).toBe('https://subdomain.example.com:8080/path');
        });
    });

    describe('getLineNumber and getColumnNumber methods', () => {
        test('should calculate correct line number', () => {
            const content = 'line1\nline2\nline3\nline4';
            const index = content.indexOf('line3');

            const lineNumber = fileDetectionScanner.getLineNumber(content, index);

            expect(lineNumber).toBe(3);
        });

        test('should calculate correct column number', () => {
            const content = 'line1\nline2\nline3\nline4';
            const index = content.indexOf('line3') + 2; // Position at 'n' in 'line3'

            const columnNumber = fileDetectionScanner.getColumnNumber(content, index);

            expect(columnNumber).toBe(3);
        });

        test('should handle edge cases', () => {
            expect(fileDetectionScanner.getLineNumber('', -1)).toBe(1);
            expect(fileDetectionScanner.getLineNumber(null, 0)).toBe(1);
            expect(fileDetectionScanner.getColumnNumber('', -1)).toBe(1);
            expect(fileDetectionScanner.getColumnNumber(null, 0)).toBe(1);
        });
    });

    describe('Directory listing detection (Task 4.2)', () => {
        describe('checkDirectoryListing method', () => {
            test('should detect Apache directory listing', async () => {
                const mockHttpClient = {
                    get: jest.fn().mockResolvedValue({
                        status: 200,
                        headers: {
                            'content-type': 'text/html',
                            'content-length': '500'
                        },
                        data: '<html><head><title>Index of /admin</title></head><body><h1>Index of /admin</h1><table><tr><th>Name</th><th>Last modified</th><th>Size</th></tr><tr><td><a href="../">Parent Directory</a></td></tr></table></body></html>'
                    })
                };
                fileDetectionScanner.httpClient = mockHttpClient;

                const result = await fileDetectionScanner.checkDirectoryListing('https://example.com/admin/', 'admin');

                expect(result).toBeTruthy();
                expect(result.type).toBe('Directory Listing Vulnerability');
                expect(result.severity).toBe('critical');
                expect(result.value).toBe('admin');
                expect(result.metadata.listingType).toBe('HTML');
            });

            test('should detect nginx directory listing', async () => {
                const mockHttpClient = {
                    get: jest.fn().mockResolvedValue({
                        status: 200,
                        headers: {
                            'content-type': 'text/html',
                            'content-length': '400'
                        },
                        data: '<html><head><title>Index of /backup</title></head><body><h1>Index of /backup</h1><pre><a href="../">../</a>\n<a href="file1.txt">file1.txt</a></pre></body></html>'
                    })
                };
                fileDetectionScanner.httpClient = mockHttpClient;

                const result = await fileDetectionScanner.checkDirectoryListing('https://example.com/backup/', 'backup');

                expect(result).toBeTruthy();
                expect(result.type).toBe('Directory Listing Vulnerability');
                expect(result.severity).toBe('high');
                expect(result.value).toBe('backup');
            });

            test('should detect JSON directory listing', async () => {
                const mockHttpClient = {
                    get: jest.fn().mockResolvedValue({
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                            'content-length': '200'
                        },
                        data: '[{"name": "file1.txt", "size": 1024}, {"name": "file2.txt", "size": 2048}]'
                    })
                };
                fileDetectionScanner.httpClient = mockHttpClient;

                const result = await fileDetectionScanner.checkDirectoryListing('https://example.com/files/', 'files');

                expect(result).toBeTruthy();
                expect(result.type).toBe('Directory Listing Vulnerability');
                expect(result.severity).toBe('medium');
                expect(result.metadata.listingType).toBe('JSON');
            });

            test('should return null for non-directory listing responses', async () => {
                const mockHttpClient = {
                    get: jest.fn().mockResolvedValue({
                        status: 200,
                        headers: {
                            'content-type': 'text/html',
                            'content-length': '300'
                        },
                        data: '<html><head><title>Regular Page</title></head><body><h1>Welcome</h1><p>This is a regular page</p></body></html>'
                    })
                };
                fileDetectionScanner.httpClient = mockHttpClient;

                const result = await fileDetectionScanner.checkDirectoryListing('https://example.com/admin/', 'admin');

                expect(result).toBeNull();
            });

            test('should return null for 404 responses', async () => {
                const mockHttpClient = {
                    get: jest.fn().mockRejectedValue({
                        response: { status: 404 }
                    })
                };
                fileDetectionScanner.httpClient = mockHttpClient;

                const result = await fileDetectionScanner.checkDirectoryListing('https://example.com/admin/', 'admin');

                expect(result).toBeNull();
            });
        });

        describe('checkBackupFiles method', () => {
            test('should detect exposed backup files', async () => {
                const mockHttpClient = {
                    get: jest.fn()
                        .mockResolvedValueOnce({
                            status: 200,
                            headers: {
                                'content-type': 'text/plain',
                                'content-length': '150'
                            },
                            data: 'Original index.php content'
                        })
                        .mockRejectedValue({ response: { status: 404 } })
                };

                fileDetectionScanner.httpClient = mockHttpClient;

                const results = await fileDetectionScanner.checkBackupFiles('https://example.com');

                expect(results.length).toBeGreaterThan(0);
                const backupFile = results[0];
                expect(backupFile.type).toBe('Exposed Backup File');
                expect(backupFile.pattern.category).toBe('vulnerabilities');
                expect(backupFile.value).toMatch(/index\.(bak|backup|old|orig|save|tmp|swp|swo|~|copy|1|2)/);
            });

            test('should handle no backup files found', async () => {
                const mockHttpClient = {
                    get: jest.fn().mockRejectedValue({ response: { status: 404 } })
                };
                fileDetectionScanner.httpClient = mockHttpClient;

                const results = await fileDetectionScanner.checkBackupFiles('https://example.com');

                expect(results).toEqual([]);
            });
        });

        describe('isDirectoryListing method', () => {
            test('should identify HTML directory listings', () => {
                const htmlContent = '<html><head><title>Index of /test</title></head><body><h1>Index of /test</h1></body></html>';

                const result = fileDetectionScanner.isDirectoryListing(htmlContent, 'text/html');

                expect(result).toBe(true);
            });

            test('should identify Apache-style directory listings', () => {
                const apacheContent = '<html><body><table><tr><th>Name</th><th>Last modified</th><th>Size</th></tr><tr><td><a href="../">Parent Directory</a></td></tr></table></body></html>';

                const result = fileDetectionScanner.isDirectoryListing(apacheContent, 'text/html');

                expect(result).toBe(true);
            });

            test('should identify JSON directory listings', () => {
                const jsonContent = '[{"name": "file1.txt", "size": 1024}, {"name": "file2.txt", "size": 2048}]';

                const result = fileDetectionScanner.isDirectoryListing(jsonContent, 'application/json');

                expect(result).toBe(true);
            });

            test('should identify plain text directory listings', () => {
                const textContent = '2023-01-01 12:00 file1.txt\n2023-01-02 13:00 file2.txt\n2023-01-03 14:00 file3.txt';

                const result = fileDetectionScanner.isDirectoryListing(textContent, 'text/plain');

                expect(result).toBe(true);
            });

            test('should not identify regular HTML pages as directory listings', () => {
                const regularContent = '<html><head><title>Welcome</title></head><body><h1>Welcome to our site</h1><p>Content here</p></body></html>';

                const result = fileDetectionScanner.isDirectoryListing(regularContent, 'text/html');

                expect(result).toBe(false);
            });

            test('should handle invalid JSON gracefully', () => {
                const invalidJson = '{"invalid": json content}';

                const result = fileDetectionScanner.isDirectoryListing(invalidJson, 'application/json');

                expect(result).toBe(false);
            });
        });

        describe('getDirectorySeverity method', () => {
            test('should return critical for sensitive directories', () => {
                expect(fileDetectionScanner.getDirectorySeverity('.git')).toBe('critical');
                expect(fileDetectionScanner.getDirectorySeverity('admin')).toBe('critical');
                expect(fileDetectionScanner.getDirectorySeverity('secrets')).toBe('critical');
            });

            test('should return high for config directories', () => {
                expect(fileDetectionScanner.getDirectorySeverity('backup')).toBe('high');
                expect(fileDetectionScanner.getDirectorySeverity('config')).toBe('high');
                expect(fileDetectionScanner.getDirectorySeverity('database')).toBe('high');
            });

            test('should return medium for less sensitive directories', () => {
                expect(fileDetectionScanner.getDirectorySeverity('logs')).toBe('medium');
                expect(fileDetectionScanner.getDirectorySeverity('temp')).toBe('medium');
                expect(fileDetectionScanner.getDirectorySeverity('uploads')).toBe('medium');
            });

            test('should return low for unknown directories', () => {
                expect(fileDetectionScanner.getDirectorySeverity('unknown')).toBe('low');
            });
        });

        describe('getBackupFileSeverity method', () => {
            test('should return high for critical backup files', () => {
                expect(fileDetectionScanner.getBackupFileSeverity('config', '.bak')).toBe('high');
                expect(fileDetectionScanner.getBackupFileSeverity('database', '.old')).toBe('high');
                expect(fileDetectionScanner.getBackupFileSeverity('admin', '.backup')).toBe('high');
            });

            test('should return medium for important backup files', () => {
                expect(fileDetectionScanner.getBackupFileSeverity('index', '.bak')).toBe('medium');
                expect(fileDetectionScanner.getBackupFileSeverity('app', '.old')).toBe('medium');
                expect(fileDetectionScanner.getBackupFileSeverity('main', '.backup')).toBe('medium');
            });

            test('should return low for other backup files', () => {
                expect(fileDetectionScanner.getBackupFileSeverity('other', '.bak')).toBe('low');
            });
        });

        describe('calculateDirectoryConfidence method', () => {
            test('should give high confidence for clear directory listings', () => {
                const mockResponse = {
                    headers: {
                        'content-type': 'text/html',
                        'content-length': '500'
                    }
                };
                const content = '<title>Index of /admin</title><h1>Index of /admin</h1><a href="../">Parent Directory</a>';

                const confidence = fileDetectionScanner.calculateDirectoryConfidence('admin', content, mockResponse);

                expect(confidence).toBeGreaterThan(0.9);
            });

            test('should give lower confidence for ambiguous content', () => {
                const mockResponse = {
                    headers: {
                        'content-type': 'text/html',
                        'content-length': '50'
                    }
                };
                const content = '<html><body>Some content</body></html>';

                const confidence = fileDetectionScanner.calculateDirectoryConfidence('unknown', content, mockResponse);

                expect(confidence).toBeLessThan(0.8);
            });
        });

        describe('getListingType method', () => {
            test('should identify Apache listings', () => {
                const content = '<html><body>Apache/2.4.41 Server at example.com Port 80</body></html>';

                const result = fileDetectionScanner.getListingType(content, 'text/html');

                expect(result).toBe('Apache');
            });

            test('should identify Nginx listings', () => {
                const content = '<html><body>nginx/1.18.0</body></html>';

                const result = fileDetectionScanner.getListingType(content, 'text/html');

                expect(result).toBe('Nginx');
            });

            test('should identify JSON listings', () => {
                const result = fileDetectionScanner.getListingType('[]', 'application/json');

                expect(result).toBe('JSON');
            });

            test('should identify plain text listings', () => {
                const result = fileDetectionScanner.getListingType('file list', 'text/plain');

                expect(result).toBe('Plain Text');
            });

            test('should return HTML for generic HTML listings', () => {
                const result = fileDetectionScanner.getListingType('<html></html>', 'text/html');

                expect(result).toBe('HTML');
            });
        });
    });

    describe('Integration tests', () => {
        test('should handle content analysis with secrets and increase severity', async () => {
            const mockHttpClient = {
                get: jest.fn().mockResolvedValue({
                    status: 200,
                    headers: {
                        'content-type': 'text/plain',
                        'content-length': '100'
                    },
                    data: 'OPENAI_API_KEY=sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nDATABASE_URL=localhost'
                })
            };
            fileDetectionScanner.httpClient = mockHttpClient;

            const result = await fileDetectionScanner.checkFileAccessibility('https://example.com/.env', '.env');

            expect(result).toBeTruthy();
            expect(result.severity).toBe('critical'); // Should be critical due to secrets found
            expect(result.contentAnalysis).toBeDefined();
            expect(result.contentAnalysis.length).toBeGreaterThan(0);
            expect(result.confidence).toBeGreaterThan(0.9); // Confidence should be boosted
        });

        test('should scan for both files and directories', async () => {
            const mockHttpClient = {
                get: jest.fn()
                    .mockResolvedValueOnce({
                        status: 200,
                        headers: {
                            'content-type': 'text/plain',
                            'content-length': '100'
                        },
                        data: 'API_KEY=test123'
                    })
                    .mockResolvedValueOnce({
                        status: 200,
                        headers: {
                            'content-type': 'text/html',
                            'content-length': '300'
                        },
                        data: '<title>Index of /admin</title><h1>Index of /admin</h1>'
                    })
                    .mockRejectedValue({ response: { status: 404 } })
            };

            fileDetectionScanner.httpClient = mockHttpClient;

            const target = { value: 'https://example.com' };
            const options = { onProgress: jest.fn() };

            const results = await fileDetectionScanner.scan(target, options);

            expect(results.length).toBeGreaterThanOrEqual(2);

            // Should have both file and directory findings
            const fileFindings = results.filter(r => r.type === 'Exposed Sensitive File');
            const dirFindings = results.filter(r => r.type === 'Directory Listing Vulnerability');

            expect(fileFindings.length).toBeGreaterThan(0);
            expect(dirFindings.length).toBeGreaterThan(0);
        });
    });
});