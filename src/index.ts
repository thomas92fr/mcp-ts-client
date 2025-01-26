import AnthropicToolAdapter from './AnthropicToolAdapter.js';
import { ConsoleLogger, MCPStdioClient } from './MCPStdioClient.js';
import {  stringify } from 'yaml';

// Exemple d'utilisation
async function main() {
    console.log("Démarrage du test du client MCP...");
    
    

    const client = new MCPStdioClient(
        'I:\\Node Projects\\mcp-ts-toolskit\\build\\index.js',
        {
            MCP_TOOLSKIT_CONFIG_PATH: 'C:/tmp/config.json'
        }
    );

    try {
        // Attendre l'initialisation de la session
        console.log("Attente de l'initialisation de la session...");
        await client.waitForSession();
        console.log("Session initialisée avec succès !");

        /*
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
          
            const adapter = new AnthropicToolAdapter([client], "");
            const response = await adapter.chat("Peux tu charger le contenu de la page web 'https://www.trasis.com/en/', et de quoi cela parle ?");
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
        client.close();
        console.log("\nTests terminés");
    }
}

// Exécuter les tests
main().catch(console.error);
