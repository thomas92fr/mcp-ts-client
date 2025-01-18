# MCP TypeScript Client

## Description

Un client TypeScript pour le Model Context Protocol (MCP), un standard ouvert facilitant l'intégration sécurisée entre les applications d'intelligence artificielle et les sources de données externes.

## Model Context Protocol (MCP)

### Principes Fondamentaux

Le Model Context Protocol est un standard de communication conçu pour :
- Établir des connexions bidirectionnelles sécurisées entre les outils alimentés par IA et les sources de données
- Standardiser l'échange de contextes et de modèles entre différents systèmes
- Simplifier l'intégration des applications de Large Language Models (LLM)

### Architecture

- **Client-Serveur**: Communication basée sur un modèle client-serveur flexible
- **Transport**: Utilise JSON-RPC 2.0 pour l'échange de messages
- **Sécurité**: Gestion des autorisations et des contextes

## Méthodes Clés

### `listTools()`

Découvrez les outils disponibles sur le serveur MCP.

```typescript
const tools = await client.listTools();
console.log('Outils disponibles :', tools);
```

#### Caractéristiques
- Retourne une liste dynamique des capacités du serveur
- Permet une découverte flexible des fonctionnalités
- Supporte le filtrage et la configuration des outils

### `listAllowedDirectories()`

Identifiez les répertoires sécurisés accessibles.

```typescript
const directories = await client.listAllowedDirectories();
console.log('Répertoires autorisés :', directories);
```

#### Caractéristiques
- Renforce la sécurité en limitant l'accès aux répertoires
- Fournit une vue claire de l'environnement d'exécution
- Prévient les accès non autorisés

## Exemple Complet

```typescript
import { MCPStdioClient } from 'mcp-ts-client';

async function explorerContexteMCP() {
    const client = new MCPStdioClient('chemin/vers/serveur/mcp');
    
    try {
        await client.waitForSession();
        
        // Explorer les capacités du serveur
        const tools = await client.listTools();
        console.log('Outils disponibles :', tools);
        
        // Vérifier les répertoires accessibles
        const directories = await client.listAllowedDirectories();
        console.log('Répertoires autorisés :', directories);
        
    } catch (error) {
        console.error('Erreur lors de l\'exploration du contexte :', error);
    } finally {
        client.close();
    }
}

explorerContexteMCP();
```

## Avantages du Model Context Protocol

- **Interopérabilité** : Communication standardisée entre différents systèmes
- **Flexibilité** : Adaptation à divers cas d'utilisation
- **Sécurité** : Contrôle granulaire des accès et des ressources
- **Extensibilité** : Facile à étendre pour de nouveaux cas d'usage

## Installation

```bash
npm install mcp-ts-client
```

## Configuration

Configuration flexible basée sur les capacités du serveur MCP.

## Licence

Apache License 2.0

## Auteur

Thomas DEVIN
