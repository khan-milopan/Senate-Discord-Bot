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
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} from "discord.js";
import { file } from "bun";
import { Database } from "bun:sqlite";

const BOT_TOKEN = await file("./TOKEN").text();
const BOT_APPLICATION_ID = await file("./APPLICATION_ID").text();
const CONFIG = JSON.parse(await file("config.json").text());

const issueMsg = "**Sorry, it seems that there was an issue 😦**"

const motionsDb = new Database("./motions.db");


motionsDb.run(`
    CREATE TABLE IF NOT EXISTS active_motions (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        content     TEXT NOT NULL,
        history     TEXT NOT NULL,
        creation_date TEXT NOT NULL,
        author_id   TEXT NOT NULL,
        voting_open INTEGER NOT NULL,
        votes       TEXT NOT NULL
    )
`);

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
            .setName("content")
            .setDescription("Specify the content of the motion, what is it that you're proposing?")
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000)
        )
        .addStringOption(option => option
            .setName("type")
            .setDescription("Is this motion limited to Senators or open to the Forum?")
            .setRequired(false)
            .addChoices(
                { name: "Senate", value: "senate" },
                { name: "Forum", value: "forum" }
            )
        )
].map((scmd) => scmd.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
await rest.put(Routes.applicationCommands(BOT_APPLICATION_ID), { body: commands });

function updateActiveMotions() {
    const activeMotions = motionsDb.query("SELECT id FROM active_motions").all();
    return activeMotions;
};
let activeMotions = updateActiveMotions();
console.log(activeMotions);


// Commands and interactions bellow

function hasher(whatToHash: any, sliceNum: number) {
    const hashed = new Bun.CryptoHasher('sha256')
        .update(whatToHash)
        .digest('hex')
        .slice(0, sliceNum);

    return `${hashed}`;
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

    const stmt = motionsDb.prepare(`
        INSERT INTO active_motions (id, type, content, history, creation_date, author_id, voting_open, votes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        motionId,
        motionType,
        motionContent,
        JSON.stringify([motionContent]),
        interaction.createdAt.toISOString().replace("T", " ").replace("Z", ""),
        interaction.user.id,
        false,
        JSON.stringify(votes)
    )

    return true
}

function typeById(channelId: string) {
    if (channelId === CONFIG.senate.channelId) {
        return "senate"
    } if (channelId == CONFIG.forum.channelId) {
        return "forum"
    } else {
        console.log(`typeById failed to determine the type of this channel: '${channelId}'`)
        return "failed"
    }
}

function voteButtons(votingOpen: boolean, abstain: boolean) {
    const forButton = new ButtonBuilder()
        .setCustomId("for")
        .setLabel("Vote For")
        .setStyle(ButtonStyle.Success)
        .setDisabled(votingOpen ? false : true);

    const againstButton = new ButtonBuilder()
        .setCustomId("against")
        .setLabel("Vote Against")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(votingOpen ? false : true);

    const abstainButton = new ButtonBuilder()
        .setCustomId("abstain")
        .setLabel("Abstain")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(votingOpen ? false : true);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        forButton,
        againstButton,
        ...(abstain ? [abstainButton] : [])
    );
}

async function motion(interaction: ChatInputCommandInteraction) {
    const type: string = interaction.options.getString("type") ?? typeById(interaction.channelId);
    const content: string = interaction.options.getString('content', true)

    if (type == "failed") {
        await interaction.reply({
            content: "**Failed to automatically determine channel type! Please manually specify it!**",
            flags: MessageFlags.Ephemeral
        })
        return
    }

    const motionChannelId = CONFIG[type].channelId
    const motionChannel = await client.channels.fetch(motionChannelId)

    if (!motionChannel || !(motionChannel instanceof TextChannel)) {
        console.log(`Failed to send a motion!\n    by '${interaction.user.displayName}' (${interaction.user.id})\n    to '${type}' type channel ('${motionChannelId}')\n    containing '${content}'`)
        await interaction.reply({
            content: issueMsg,
            flags: MessageFlags.Ephemeral
        })
    } else {
        const motionId = `${hasher(`${content}${interaction.channelId}${interaction.user.id}`, 8)}-${interaction.createdTimestamp}`
        if (
            saveNewMotion(motionId, type, content, interaction)
        ) {
            const abstain = type === "senate" ? true : false;
            await motionChannel.send({
                content: `<@${interaction.user.id}> started a motion: ' ${content} '\n-# Motion ID: ${motionId}`,
                components: [voteButtons(false, abstain)]
            })
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

    if (![CONFIG.senate.channelId, CONFIG.forum.channelId].includes(interaction.channelId)) {
        await interaction.reply({
            content: `I don't operate in this channel, I'm limited to <#${CONFIG.senate.channelId}> and <#${CONFIG.forum.channelId}>`,
            flags: MessageFlags.Ephemeral
        });
        return
    }

    switch (commandName) {
        case "motion":
            motion(interaction)
            break;

        case "test":
            await interaction.reply(`She testing on my <@${client.user?.id}> till I reply`)
            break;

        default:
            await interaction.reply({
                content: "**Unknown command!**",
                flags: MessageFlags.Ephemeral
            });
            break;
    }

});

client.login(BOT_TOKEN);