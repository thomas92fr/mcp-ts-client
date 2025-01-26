import { ILogger, MCPStdioClient } from "./MCPStdioClient.js";

/**
 * Interface définissant le format d'un outil compatible avec l'API Anthropic
 */
type Tool = {
  /**
   * Identifiant unique de l'outil au format {server}-{tool}
   * Doit correspondre au pattern ^[a-zA-Z0-9_-]{1,64}$
   */
  name: string;
  /**
   * Description de l'outil et de son utilisation
   * Optionnel
   */
  description?: string;
  /**
   * Schéma des paramètres d'entrée au format JSON Schema
   */
  input_schema: {
    /**
     * Toujours "object" pour la compatibilité Anthropic
     */
    type: "object";
    /**
     * Définition des propriétés du schéma
     * Les clés doivent être au format [a-zA-Z0-9_-]
     */
    properties: Record<string, any>;
    /**
     * Liste des propriétés requises
     * Optionnel
     */
    required?: string[];
  };
};

/**
 * Interface représentant le mapping entre le nom unique d'un outil et ses informations d'origine
 */
interface ToolMapping {
  /** Nom du serveur MCP d'origine */
  originalServer: string;
  /** Nom initial de l'outil dans le serveur MCP */
  originalName: string;
  /** Nom unique généré pour l'API Anthropic au format {server}-{tool} */
  uniqueName: string;
}

/**
 * Adaptateur pour intégrer plusieurs clients de serveurs MCP avec l'API Anthropic
 */
class AnthropicToolAdapter {
  private mcpClients: MCPStdioClient[];

  private toolMappings: ToolMapping[] = [];
  private logger?: ILogger;

  /**
   * Construit un adaptateur pour interfacer plusieurs clients MCP avec l'API Anthropic
   * @param mcpClients - Array de clients MCP à intégrer
   * @param logger - Logger optionnel pour le suivi des opérations
   */
  constructor(mcpClients: MCPStdioClient[], logger?: ILogger) {
    this.logger = logger;
    this.mcpClients = mcpClients;
  }

  /**
   * Génère un nom unique pour un outil en combinant le nom du serveur et le nom de l'outil
   * Les underscores sont convertis en tirets et les caractères non-alphanumériques sont nettoyés
   * @param serverName Nom du serveur
   * @param toolName Nom de l'outil
   * @returns Nom unique au format {server}-{tool} compatible avec l'API Anthropic
   */
  private generateUniqueName(serverName: string, toolName: string): string {
    const cleanServer = serverName.replace(/[_]/g, "-");
    const cleanTool = toolName.replace(/[_]/g, "-");
    return `${cleanServer}_${cleanTool}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  /**
   * Récupère tous les outils disponibles sur tous les clients MCP
   * Génère des noms uniques pour chaque outil et maintient un mapping avec les noms originaux
   * @returns Liste des outils au format attendu par l'API Anthropic
   */
  async getTools(): Promise<Tool[]> {
    this.toolMappings = [];
    const toolsWithServerNames = await Promise.all(
      this.mcpClients.map(async (client) => {
        const serverName = await client.getServerName();
        const response = await client.listTools<{
          tools: Array<{ name: string; description: string; inputSchema: any }>;
        }>();

        return response.tools.map((tool) => {
          const uniqueName = this.generateUniqueName(serverName, tool.name);
          this.toolMappings.push({
            originalServer: serverName,
            originalName: tool.name,
            uniqueName,
          });

          return {
            ...tool,
            name: uniqueName,
          };
        });
      })
    );

    const allTools = toolsWithServerNames.flat();
    return allTools.map((tool) => ({
      name: tool.name,
      description: tool.description || `Execute ${tool.name} tool`,
      input_schema: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(tool.inputSchema.properties || {}).map(
            ([key, value]) => [key.replace(/[^a-zA-Z0-9_-]/g, "_"), value]
          )
        ),
        required: tool.inputSchema.required,
      },
    }));
  }

  /**
   * Gère l'exécution d'un outil demandé par l'API Anthropic
   * Retrouve le client et l'outil d'origine à partir du nom unique
   * @param toolUse Informations sur l'outil à exécuter
   * @returns Résultat formaté pour l'API Anthropic
   */
  async handleToolUse(toolUse: any) {
    const { name, input, id } = toolUse;
    const mapping = this.toolMappings.find((m) => m.uniqueName === name);

    if (!mapping) {
      throw new Error(`Tool mapping not found for: ${name}`);
    }

    const client = await this.findClientByServerName(mapping.originalServer);
    if (!client) {
      throw new Error(`Server not found: ${mapping.originalServer}`);
    }

    try {
      const result = await client.invokeTool(mapping.originalName, input);
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: id,
            content: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: id,
            content: String(error),
            is_error: true,
          },
        ],
      };
    }
  }

  /**
   * Recherche un client MCP par son nom de serveur
   * @param serverName Nom du serveur à trouver
   * @returns Le client correspondant ou undefined
   */
  private async findClientByServerName(
    serverName: string
  ): Promise<MCPStdioClient | undefined> {
    for (const client of this.mcpClients) {
      if ((await client.getServerName()) === serverName) {
        return client;
      }
    }
    return undefined;
  }
}

export default AnthropicToolAdapter;
