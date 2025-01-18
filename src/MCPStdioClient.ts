import { spawn } from 'child_process';
import type { MCPMessage, MCPRequest, MCPResponse, ClientInfo } from './types.js';

export class MCPStdioClient {
    private process: any;
    private messageQueue: Map<string, { 
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }>;
    private sessionId: string | null = null;
    private readonly clientInfo: ClientInfo = {
        name: 'mcp-client',
        version: '1.0.0'
    };

    constructor(serverPath: string) {
        this.messageQueue = new Map();
        
        console.log('Starting MCP server:', serverPath);
        
        // Lancer le processus du serveur MCP avec des options supplémentaires
        this.process = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
            windowsHide: true
        });

        // Gérer les messages du serveur avec une meilleure gestion des erreurs
        this.process.stdout.on('data', (data: Buffer) => {
            const response = data.toString();
            console.log('Server response:', response);
            
            try {
                const messages = response.split('\n').filter(line => line.trim());
                for (const message of messages) {
                    const parsedResponse = JSON.parse(message);
                    console.log('Parsed response:', parsedResponse);
                    this.handleMessage(parsedResponse);
                }
            } catch (error) {
                console.error('Error parsing server response:', error);
                console.error('Raw response:', response);
                // Propager l'erreur aux promesses en attente
                for (const [id, { reject }] of this.messageQueue) {
                    reject(error);
                    this.messageQueue.delete(id);
                }
            }
        });

        // Amélioration de la gestion des erreurs
        this.process.stderr.on('data', (data: Buffer) => {
            const errorMessage = data.toString().trim();
            console.error('Server error:', errorMessage);
        });

        // Gestion de la fermeture du processus
        this.process.on('close', (code: number) => {
            console.log(`Server process exited with code ${code}`);
            // Rejeter toutes les promesses en attente
            for (const [id, { reject }] of this.messageQueue) {
                reject(new Error(`Server process exited with code ${code}`));
                this.messageQueue.delete(id);
            }
        });

        // Initialiser la session immédiatement
        this.initSession().catch(error => {
            console.error("Failed to initialize session:", error);
        });
    }

    private async initSession(): Promise<void> {
        console.log("Initializing MCP session...");
        
        // Attendre que le process soit prêt
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Initialisation unique
        const initRequestId = this.generateRequestId();
        const initRequest: MCPRequest = {
            jsonrpc: '2.0',
            id: initRequestId,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                clientInfo: this.clientInfo,
                capabilities: {
                    tools: {}
                }
            }
        };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.messageQueue.delete(initRequestId);
                reject(new Error('Initialization timeout'));
            }, 30000);

            this.messageQueue.set(initRequestId, {
                resolve: (value) => {
                    clearTimeout(timeoutId);
                    // Après l'initialisation réussie, on considère la session comme établie
                    if (value && value.protocolVersion) {
                        this.sessionId = initRequestId; // Utiliser l'ID de la requête comme ID de session
                        console.log("Session initialized successfully");
                        resolve();
                    } else {
                        reject(new Error("Invalid initialization response"));
                    }
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            console.log('Sending initialization request:', JSON.stringify(initRequest, null, 2));
            this.process.stdin.write(JSON.stringify(initRequest) + '\n');
        });
    }

    private generateRequestId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    private handleMessage(message: any): void {
        console.log("Handling message:", message);
        
        // Gérer les pings
        if (message.method === 'ping') {
            const pongResponse = {
                jsonrpc: '2.0',
                method: 'pong',
                id: message.id
            };
            console.log('Sending pong response:', JSON.stringify(pongResponse));
            this.process.stdin.write(JSON.stringify(pongResponse) + '\n');
            return;
        }

        // Gérer les réponses normales
        const pendingRequest = this.messageQueue.get(message.id);
        if (pendingRequest) {
            if (message.error) {
                pendingRequest.reject(new Error(message.error.message));
            } else {
                pendingRequest.resolve(message.result);
            }
            this.messageQueue.delete(message.id);
        }
    }

    async listTools<T = any>(parameters: Record<string, any> = {}): Promise<T> {
        if (!this.sessionId) {
            throw new Error('No active session. Make sure to wait for session initialization.');
        }
    
        const requestId = this.generateRequestId();
        const request: MCPRequest = {
            jsonrpc: '2.0',
            id: requestId,
            method: 'tools/list',
            params: parameters
        };
    
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.messageQueue.delete(requestId);
                reject(new Error('Tools list invocation timeout'));
            }, 30000);
    
            this.messageQueue.set(requestId, {
                resolve: (value) => {
                    clearTimeout(timeoutId);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });
    
            try {
                console.log('Sending tools list request:', JSON.stringify(request, null, 2));
                this.process.stdin.write(JSON.stringify(request) + '\n');
            } catch (error) {
                clearTimeout(timeoutId);
                this.messageQueue.delete(requestId);
                reject(error);
            }
        });
    }

    async invokeTool<T = any>(toolName: string, parameters: Record<string, any> = {}): Promise<T> {
        if (!this.sessionId) {
            throw new Error('No active session. Make sure to wait for session initialization.');
        }

        const requestId = this.generateRequestId();
        const request: MCPRequest = {
            jsonrpc: '2.0',
            id: requestId,
            method: 'tools/call',  
            params: {
                name: toolName,
                arguments: parameters
            }
        };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.messageQueue.delete(requestId);
                reject(new Error(`Tool invocation timeout for ${toolName}`));
            }, 30000);

            this.messageQueue.set(requestId, {
                resolve: (value) => {
                    clearTimeout(timeoutId);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            try {
                console.log('Sending tool invocation request:', JSON.stringify(request, null, 2));
                this.process.stdin.write(JSON.stringify(request) + '\n');
            } catch (error) {
                clearTimeout(timeoutId);
                this.messageQueue.delete(requestId);
                reject(error);
            }
        });
    }


    // Méthodes utilitaires typées
    async listAllowedDirectories(): Promise<string[]> {
        return this.invokeTool<string[]>('list_allowed_directories');
    }

    async readMultipleFiles(paths: string[]): Promise<Record<string, string>> {
        return this.invokeTool<Record<string, string>>('read_multiple_files', { paths });
    }

    async searchFiles(path: string, pattern: string): Promise<string[]> {
        return this.invokeTool<string[]>('search_files', { path, pattern });
    }

    // Vérifier si la session est prête
    isSessionReady(): boolean {
        return this.sessionId !== null;
    }

    // Attendre que la session soit prête
    async waitForSession(timeout = 30000): Promise<void> {
        console.log("Waiting for session to be ready...");
        const startTime = Date.now();
        while (!this.isSessionReady()) {
            if (Date.now() - startTime > timeout) {
                throw new Error('Session initialization timeout');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log("Session is ready!");
    }

    // Fermer la connexion
    close(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }

    // Vérifier si le client est connecté
    isConnected(): boolean {
        return this.process !== null && !this.process.killed;
    }
}