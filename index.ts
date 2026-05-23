import { Client, GatewayIntentBits, Events, Message } from "discord.js";
import { file } from "bun";

const DISCORD_TOKEN = await file("./TOKEN").text();
const RAW_CONFIG = await file("config.json").text();
const CONFIG = JSON.parse(RAW_CONFIG);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, (message: Message) => {
    if (message.author.bot) return;

    if (message.content.startsWith(CONFIG.chatCommandPrefix)) {
        const cc = message.content.slice(7);
        if (cc === "test") {
            message.reply(`She testing on my <@${client.user?.id}> till I reply`)
        } else {
            message.reply("Hii! 👋")
        }
    }
})

client.login(DISCORD_TOKEN);