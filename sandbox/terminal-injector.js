// Terminal Command Injector for ttyd
// This script handles command injection into the ttyd terminal

class TerminalInjector {
    constructor() {
        this.terminal = null;
        this.websocket = null;
        this.init();
    }

    init() {
        // Wait for ttyd to load
        this.waitForTerminal();

        // Listen for messages from parent window
        window.addEventListener('message', (event) => {
            if (event.data.type === 'command') {
                this.injectCommand(event.data.command);
            }
        });
    }

    waitForTerminal() {
        const checkInterval = setInterval(() => {
            // Look for ttyd terminal elements
            const terminal = document.querySelector('.ttyd-terminal') ||
                document.querySelector('#terminal') ||
                document.querySelector('canvas');

            if (terminal) {
                this.terminal = terminal;
                this.setupWebSocket();
                clearInterval(checkInterval);
                console.log('Terminal found and ready for command injection');
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            console.log('Terminal not found within timeout');
        }, 10000);
    }

    setupWebSocket() {
        // Find the WebSocket connection
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            if (script.textContent.includes('WebSocket')) {
                // Extract WebSocket URL from script
                const wsMatch = script.textContent.match(/new WebSocket\(['"]([^'"]+)['"]\)/);
                if (wsMatch) {
                    this.websocket = new WebSocket(wsMatch[1]);
                    this.websocket.onopen = () => {
                        console.log('WebSocket connected for command injection');
                    };
                    break;
                }
            }
        }
    }

    injectCommand(command) {
        console.log('Injecting command:', command);

        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            // Send the command via WebSocket
            this.websocket.send(command + '\n');

            // Also try to simulate typing in the terminal
            this.simulateTyping(command);
        } else {
            // Fallback: try to simulate keyboard input
            this.simulateTyping(command);
        }
    }

    simulateTyping(command) {
        // Create a keyboard event to type the command
        const inputEvent = new InputEvent('input', {
            data: command,
            bubbles: true,
            cancelable: true
        });

        // Try to find input elements
        const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
        if (inputs.length > 0) {
            const input = inputs[0];
            input.focus();
            input.value = command;
            input.dispatchEvent(inputEvent);

            // Send Enter key
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            input.dispatchEvent(enterEvent);
        } else {
            // Try to send to document body
            document.body.focus();
            document.dispatchEvent(inputEvent);
        }
    }

    // Alternative method using clipboard API
    async injectViaClipboard(command) {
        try {
            await navigator.clipboard.writeText(command);

            // Simulate Ctrl+V
            const pasteEvent = new KeyboardEvent('keydown', {
                key: 'v',
                code: 'KeyV',
                keyCode: 86,
                which: 86,
                ctrlKey: true,
                bubbles: true,
                cancelable: true
            });

            document.dispatchEvent(pasteEvent);

            // Send Enter
            setTimeout(() => {
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(enterEvent);
            }, 100);

        } catch (error) {
            console.error('Clipboard injection failed:', error);
        }
    }
}

// Initialize the injector when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new TerminalInjector();
    });
} else {
    new TerminalInjector();
}

// Export for use in iframe
window.TerminalInjector = TerminalInjector;
