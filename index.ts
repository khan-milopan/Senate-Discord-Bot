import {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    TextChannel,
    Faces
} from "discord.js";
import { file } from "bun";

const BOT_TOKEN = await file("./TOKEN").text();
const BOT_APPLICATION_ID = await file("./APPLICATION_ID").text();
const CONFIG = JSON.parse(await file("config.json").text());

const issueMsg = "**Sorry, it seems that there was an issue 😦**"

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
        .setDescription("Replies with immature unfunny meme words"),
    new SlashCommandBuilder()
        .setName("motion")
        .setDescription("Starts a motion.")
        .addStringOption(option => option
            .setName("type")
            .setDescription("Is this motion limited to Senators or open to the Forum?")
            .setRequired(true)
            .addChoices(
                { name: "Senate", value: "senate" },
                { name: "Forum", value: "forum" }
            )
        )
        .addStringOption(option => option
            .setName("content")
            .setDescription("Specify the content of the motion, what is it that you're proposing?")
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000)
        )
].map((scmd) => scmd.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
await rest.put(Routes.applicationCommands(BOT_APPLICATION_ID), { body: commands });

function idMaker(whatToHash: any, creationTimestamp: number) {
    const hashed = new Bun.CryptoHasher('sha256')
        .update(whatToHash)
        .digest('hex')
        .slice(0, 16);

    return `${hashed}-${creationTimestamp}`;
}

async function jsonWrite(path: string, object: object) {
    const objectJson = JSON.parse(await file(path).text())
    objectJson.push(object);
    await Bun.write(path, JSON.stringify(object, null, 2))
}

function saveNewMotion(motionId: string, motionType: string, motionContent: string, interaction: ChatInputCommandInteraction) {

    let votes;
    switch (motionType) {
        case "senate":
            votes = { for: [], against: [], abstaining: [] };
            break;
        case "forum":
            votes = { for: 0, against: 0, voted: [] };
            break;
    }

    const newMotion = {
        id: motionId,
        info: {
            type: motionType,
            content: {
                current: motionContent,
                history: [motionContent]
            },
            creationDate: interaction.createdAt,
            authorId: interaction.user.id,
            votes
        }
    }

    jsonWrite("./motions/active.json", newMotion)

    return true
}

async function motion(interaction: ChatInputCommandInteraction) {
    const type: string = interaction.options.getString('type', true);
    const content: string = interaction.options.getString('content', true)

    const motionChannelId = CONFIG[type].channelId
    const motionChannel = await client.channels.fetch(motionChannelId)

    if (!motionChannel || !(motionChannel instanceof TextChannel)) {
        console.log(`Failed to send a motion!\n    by '${interaction.user.displayName}' (${interaction.user.id})\n    to '${type}' type channel ('${motionChannelId}')\n    containing '${content}'`)
        await interaction.reply({
            content: issueMsg,
            flags: MessageFlags.Ephemeral
        })
    } else {
        const motionId = idMaker(`${content}${interaction.channelId}${interaction.user.id}`, interaction.createdTimestamp)
        if (
            saveNewMotion(motionId, type, content, interaction)
        ) {
            await motionChannel.send(`<@${interaction.user.id}> started a motion: ' ${content} '\n-# Motion ID: ${motionId}`)
            await interaction.reply({
                content: `**Successfully started the motion!**\n-# Go to <#${motionChannelId}>`,
                flags: MessageFlags.Ephemeral
            })
        } else (
            await interaction.reply({
                content: issueMsg,
                flags: MessageFlags.Ephemeral
            })
        )

    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction as ChatInputCommandInteraction;

    if ([CONFIG.senate.channelId, CONFIG.forum.channelId].includes(interaction.channelId)) {
        if (commandName === "motion") {
            motion(interaction)
        };
        if (commandName === "test") {
            await interaction.reply(`She testing on my <@${client.user?.id}> till I reply`)
        };
    } else {
        await interaction.reply({
            content: `I don't operate in this channel, I'm limited to <#${CONFIG.senate.channelId}> and <#${CONFIG.forum.channelId}>`,
            flags: MessageFlags.Ephemeral
        });
    }
});

client.login(BOT_TOKEN);