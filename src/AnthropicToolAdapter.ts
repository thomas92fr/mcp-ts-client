import Anthropic from '@anthropic-ai/sdk';
import { MCPStdioClient } from './MCPStdioClient.js';

interface ToolSchema {
    description?: string;
    type: string;
    properties: Record<string, any>;
    required?: string[];
}

type Tool = {
    name: string;
    description?: string;
    input_schema: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };  

class AnthropicToolAdapter {
 private mcpClient: MCPStdioClient;
 private anthropic: Anthropic;

 constructor(mcpClient: MCPStdioClient, anthropicKey: string) {
    this.mcpClient = mcpClient; 
    this.anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  async getTools(): Promise<Tool[]> {
    const response = await this.mcpClient.listTools<{tools: Array<{name: string, description: string, inputSchema: any}>}>();
    return response.tools.map(tool => {
        const schema = tool.inputSchema.properties || {};
        const properties: Record<string, any> = {};
        
        // Nettoyer les clés pour respecter le format requis
        Object.entries(schema).forEach(([key, value]) => {
            const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
            properties[cleanKey] = value;
        });

        return {
            name: tool.name,
            description: tool.description || `Execute ${tool.name} tool`,
            input_schema: {
                type: "object",
                properties,
                required: tool.inputSchema.required
            }
        };
    });
}

 private async handleToolUse(toolUse: any) {
   const { name, input, id } = toolUse;
   try {
     const result = await this.mcpClient.invokeTool(name, input);
     return {
       role: 'user',
       content: [{
         type: 'tool_result', 
         tool_use_id: id,
         content: JSON.stringify(result)
       }]
     };
   } catch (error) {
     return {
       role: 'user',
       content: [{
         type: 'tool_result',
         tool_use_id: id,
         content: String(error),
         is_error: true
       }]
     };
   }
 }

 async chat(userMessage: string): Promise<Awaited<ReturnType<typeof this.anthropic.messages.create>>> {
   const tools = await this.getTools();
   
   const message = await this.anthropic.messages.create({
     model: 'claude-3-5-sonnet-20241022',
     max_tokens: 1024,
     tools: tools,
     messages: [{ role: 'user', content: userMessage }]
   });

   if (message.stop_reason === 'tool_use' && message.content[1]) {
     const toolResult = await this.handleToolUse(message.content[1]);
     return this.chat(JSON.stringify(toolResult));
   }

   return message;
 }
}

export default AnthropicToolAdapter;