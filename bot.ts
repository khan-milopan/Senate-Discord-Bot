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
    ActionRowBuilder,
    Options,
    WebhookClient
} from "discord.js";
import { webhookInit, webhookSend } from "./webhook";
import { Database } from "bun:sqlite";

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

motionsDb.run(`
    CREATE TABLE IF NOT EXISTS archived_motions (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        content     TEXT NOT NULL,
        history     TEXT NOT NULL,
        creation_date TEXT NOT NULL,
        author_id   TEXT NOT NULL,
        votes       TEXT NOT NULL,
        achive_comment TEXT NOT NULL
    )
`);

function updateActiveMotions() {
    const activeMotions = motionsDb.query("SELECT id FROM active_motions").all() as { id: number }[];
    return activeMotions.map(item => item.id);
};
let activeMotions = updateActiveMotions();
// console.log(activeMotions);


// Commands and interactions bellow

async function qReply( // Quick Reply
    interaction: ChatInputCommandInteraction,
    custom?: string,
    hidden?: boolean
) {
    await interaction.reply({
        content: `${custom ?? "**Sorry, it seems that there was an issue 😦**"}`,
        ...(hidden !== false && { flags: MessageFlags.Ephemeral })
    });
};

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
};

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
};

async function cmdQuery(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand()

    switch (subcommand) {
        case "active":
            qReply(interaction, "active")
            break;

        case "archived":
            qReply(interaction, "archived")
            break;

        case "id":
            qReply(interaction, "id")
            break;

        default:
            qReply(interaction)
            return
    }
};

export function clientSetup(
    client: Client,
    CONFIG: any,
    WEBHOOK_URL: string
) {
    client.once(Events.ClientReady, (c) => {
        console.log(`Logged in as ${c.user.tag}`);

        if (CONFIG.notifications.enable) {
            const webhookAvatar = client.user?.avatarURL({ size: 4096, extension: "png" })
                ? client.user.defaultAvatarURL
                : undefined;
            webhookInit(
                webhookAvatar,
                CONFIG.notifications,
                WEBHOOK_URL
            )
        }
        webhookSend("The Bot is alive!")
    });

    async function cmdMotion(interaction: ChatInputCommandInteraction) {
        const type: string = interaction.options.getString("type") ?? (
            () => {
                if (interaction.channelId === CONFIG.senate.channelId) return "senate";
                if (interaction.channelId === CONFIG.forum.channelId) return "forum";
                console.log(`typeById failed to determine the type of channel: '${interaction.channelId}'`);
                return "failed";
            }
        )();
        const content: string = interaction.options.getString('content', true)

        if (type == "failed") {
            qReply(interaction, "**Failed to automatically determine channel type! Please manually specify it!**")
            return
        }

        const motionChannelId = CONFIG[type].channelId
        const motionChannel = await client.channels.fetch(motionChannelId)

        if (!motionChannel || !(motionChannel instanceof TextChannel)) {
            console.log(`Failed to send a motion!\n    by '${interaction.user.displayName}' (${interaction.user.id})\n    to '${type}' type channel ('${motionChannelId}')\n    containing '${content}'`)
            qReply(interaction)
        } else {
            const hashed = new Bun.CryptoHasher('sha256')
                .update(`${content}${interaction.channelId}${interaction.user.id}`)
                .digest('hex')
                .slice(0, 8);

            const motionId = `${hashed}-${interaction.createdTimestamp}`

            if (saveNewMotion(motionId, type, content, interaction)) {
                const abstain = type === "senate" ? true : false;
                await motionChannel.send({
                    content: `<@${interaction.user.id}> started a motion: ' ${content} '\n-# Motion ID: ${motionId}`,
                    components: [voteButtons(false, abstain)]
                })
                qReply(interaction, `**Successfully started the motion!**\n-# Go to <#${motionChannelId}>`)
            } else (
                qReply(interaction)
            )

        }
    };

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction as ChatInputCommandInteraction;
        // interaction.options.getSubcommandGroup();
        // interaction.options.getSubcommand();

        switch (commandName) {
            case "motion":
                if (![CONFIG.senate.channelId, CONFIG.forum.channelId].includes(interaction.channelId)) {
                    qReply(interaction, `This command is limited to <#${CONFIG.senate.channelId}> and <#${CONFIG.forum.channelId}>`)
                    return
                }
                cmdMotion(interaction)
                break;

            case "query":
                cmdQuery(interaction)
                break;

            case "test":
                qReply(interaction, `She testing on my <@${client.user?.id}> till I reply`, false)
                break;

            default:
                await qReply(interaction, "**Unknown command!**")
                break;
        }
    })
}