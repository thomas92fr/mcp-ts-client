export interface MCPMessage {
    jsonrpc: '2.0';
    id: string;
}

export interface ClientInfo {
    name: string;
    version: string;
}

export interface MCPRequest extends MCPMessage {
    method: string;
    params: {
        name?: string;
        version?: string;
        protocolVersion?: string;
        clientInfo?: ClientInfo;
        capabilities?: {
            tools?: Record<string, any>;
        };
        arguments?: any;
        roots?: string[];
    };
}

export interface MCPResponse extends MCPMessage {
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}