import { Bot, Context } from "grammy";
import { readdirSync } from "fs";
import { join } from "path";

interface BotCommand {
  command: string;
  description: string;
  handler: (ctx: Context) => Promise<void>;
}

let commandsCache: Map<string, BotCommand> | null = null;

const loadCommands = (): Map<string, BotCommand> => {
  if (commandsCache) {
    return commandsCache;
  }

  const commands = new Map<string, BotCommand>();
  const commandsDir = __dirname;
  
  try {
    const files = readdirSync(commandsDir);
    
    for (const file of files) {
      if (file.endsWith('.ts') && file !== 'index.ts' && !file.includes('.test.') && !file.includes('.spec.') && !file.includes('.old')) {
        const commandName = file.replace('.ts', '');
        const commandPath = join(commandsDir, file);
        
        try {
          const commandModule = require(commandPath);
          const commandHandler = commandModule[`${commandName}Command`];
          
          if (commandHandler && typeof commandHandler === 'function') {
            commands.set(commandName, {
              command: commandName,
              description: commandModule.description || `Commande ${commandName}`,
              handler: commandHandler
            });
            console.log(`✅ Commande loaded: /${commandName}`);
          } else {
            console.warn(`⚠️ Handler missing for command ${commandName}`);
          }
        } catch (error) {
          console.warn(`⚠️ Impossible to load command ${commandName}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error loading commands:", error);
    throw error;
  }
  
  commandsCache = commands;
  return commands;
};

export const registerCommands = async (bot: Bot): Promise<void> => {
  try {
    const commands = loadCommands();
    
    if (commands.size === 0) {
      console.warn("⚠️ No commands found to register");
      return;
    }
    
    for (const [commandName, command] of commands) {
      try {
        bot.command(commandName, command.handler);
        console.log(`✅ Command registered: /${commandName}`);
      } catch (error) {
        console.error(`❌ Error registering command ${commandName}:`, error);
      }
    }
    
    const botCommands = Array.from(commands.values()).map(cmd => ({
      command: cmd.command,
      description: cmd.description
    }));
    
    try {
      await bot.api.setMyCommands(botCommands);
      console.log(`✅ ${commands.size} commands configured in Telegram`);
    } catch (error) {
      console.error("❌ Error configuring commands in Telegram:", error);
    }
    
  } catch (error) {
    console.error("❌ Error registering commands:", error);
    throw error;
  }
};

export const reloadCommands = async (bot: Bot): Promise<void> => {
  console.log("🔄️ Reloading commands...");
  commandsCache = null;
  await registerCommands(bot);
};

export const getCommands = (): Map<string, BotCommand> => loadCommands();

export const getAvailableCommands = (): string[] => {
  const commands = loadCommands();
  return Array.from(commands.keys());
};