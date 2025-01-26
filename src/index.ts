import AnthropicToolAdapter from './AnthropicToolAdapter.js';
import { ConsoleLogger, createMCPClientsFromConfig, MCPStdioClient } from './MCPStdioClient.js';
import Anthropic from "@anthropic-ai/sdk";
import {  stringify } from 'yaml';


async function chat(
    userMessage: string,
    anthropicKey: string,
    anthropicToolAdapter: AnthropicToolAdapter
  ): Promise<Awaited<ReturnType<typeof anthropic.messages.create>>> {
    const anthropic = new Anthropic({ apiKey: anthropicKey });;
    
    const tools = await anthropicToolAdapter.getTools();

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      tools: tools,
      messages: [{ role: "user", content: userMessage }],
    });

    if (message.stop_reason === "tool_use" && message.content[1]) {
      const toolResult = await anthropicToolAdapter.handleToolUse(message.content[1]);
      return chat(JSON.stringify(toolResult),anthropicKey,anthropicToolAdapter);
    }

    return message;
  }


// Exemple d'utilisation
async function main() {
    console.log("Démarrage du test du client MCP...");
    
    const configPath = process.argv[2];
    if (!configPath) {
    console.error("Please provide config file path as argument");
    process.exit(1);
    }

    

   

    try {
        /*
        // Attendre l'initialisation de la session
        console.log("Attente de l'initialisation de la session...");
        await client.waitForSession();
        console.log("Session initialisée avec succès !");

        
        // Test 1: Lister les répertoires autorisés
        console.log("\nTest 1: Liste des répertoires autorisés");
        const toolslist = await client.listTools();
        console.log('Allowed directories:',stringify(toolslist));

        // Test 1: Lister les répertoires autorisés
        console.log("\nTest 1: Liste des répertoires autorisés");
        const directories = await client.listAllowedDirectories();
        console.log('Allowed directories:', directories);

        // Test 2: Rechercher des fichiers dans un répertoire
        console.log("\nTest 2: Recherche de fichiers TypeScript");
        let files = await client.searchFiles('I:\\Node Projects\\mcp-ts-client\\src', '*.ts');
        console.log('Found TypeScript files:', files);

        files = ["I:\\Node Projects\\mcp-ts-client\\src\\types.ts","I:\\Node Projects\\mcp-ts-client\\src\\index.ts"];
        // Test 3: Lire le contenu de plusieurs fichiers
        console.log("\nTest 3: Lecture de fichiers");
        if (files.length > 0) {
            const contents = await client.readMultipleFiles(files.slice(0, 2));
            console.log('Files content:', contents);
        }*/
   
        try {
            const logger = new ConsoleLogger();
            const clients = await createMCPClientsFromConfig(configPath,logger);
            const adapter = new AnthropicToolAdapter(clients, logger);
           // const tools = await adapter.getTools();
          // console.log(stringify(tools));

            const response = await chat(
                "Peux tu charger le contenu de la page web 'https://www.trasis.com/en/', et de quoi cela parle ?",
                "",
                adapter
            );
            if ('content' in response) {
                console.log(response.content);
            } else {
                for await (const event of response) {
                    console.log(event);
                }
            }
        } catch (error) {
            console.error('Error during tests:', error);
        } 

    } catch (error) {
        console.error('Error during tests:', error);
    } finally {
        //client.close();
        console.log("\nTests terminés");
    }
}

// Exécuter les tests
main().catch(console.error);
