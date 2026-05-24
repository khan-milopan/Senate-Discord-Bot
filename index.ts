import {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { file } from "bun";

const BOT_TOKEN = await file("./TOKEN").text();
const BOT_APPLICATION_ID = await file("./APPLICATION_ID").text();
const CONFIG = JSON.parse(await file("config.json").text());

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

const commands = [
    new SlashCommandBuilder()
        .setName("test")
        .setDescription("Replies with immature unfunny meme words")
].map((scmd) => scmd.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
await rest.put(Routes.applicationCommands(BOT_APPLICATION_ID), { body: commands });

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction as ChatInputCommandInteraction;

    if ([ CONFIG.senate.channelId, CONFIG.forum.channelId ].includes( interaction.channelId )) {
        if (commandName === "test") {
            await interaction.reply(`She testing on my <@${client.user?.id}> till I reply`)
        }
    } else {
        await interaction.reply({
            content: `I don't operate in this channel, I'm limited to <#${CONFIG.senate.channelId}> and <#${CONFIG.forum.channelId}>`,
            flags: MessageFlags.Ephemeral,
        });
    }
});

client.login(BOT_TOKEN);