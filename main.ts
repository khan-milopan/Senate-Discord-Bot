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
    Options
} from "discord.js";
import { stat, mkdir, open, readFile } from "fs/promises";
import { clientSetup } from "./bot";

const CONFIG: any = JSON.parse(await readFile("config.json", "utf-8"));

const pathList = [
    {
        "path": "./sensitive",
        "type": "dir",
        "req": "none"
    },
    {
        "path": "./sensitive/APPLICATION_ID",
        "type": "file",
        "req": "none"
    },
    {
        "path": "./sensitive/TOKEN",
        "type": "file",
        "req": "none"
    },
    {
        "path": "./sensitive/WEBHOOK_URL",
        "type": "file",
        "req": "CONFIG.notifications.enable"
    }
]

let wasSensitivePerfect: boolean = true;

for (const e of pathList) {

    if (e.req !== "none") {
        if (!eval(e.req)) {
            continue;
        }
    }

    if (!(await (async () => {
        try {
            const pathStat = await stat(e.path);
            if (pathStat.isDirectory()) return "dir";
            if (pathStat.isFile()) return "file";
        } catch {
            return "";
        }
    })() === e.type)) {
        wasSensitivePerfect = false
        switch (e.type) {
            case "dir":
                await mkdir(e.path, { recursive: true });
                break;

            default:
                const f = await open(e.path, "a");
                f.close()
                break;
        }
    }
}

if (!wasSensitivePerfect) {
    console.log("Created the missing 'sensitive' files, fill them before proceeding")
    process.exit(1)
}

const BOT_TOKEN = await readFile("./sensitive/TOKEN", "utf-8");
const BOT_APPLICATION_ID = await readFile("./sensitive/APPLICATION_ID", "utf-8");

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
            .addChoices(
                { name: "Senate", value: "senate" },
                { name: "Forum", value: "forum" }
            )
        ),
    new SlashCommandBuilder()
        .setName("query")
        .setDescription("Searches the database for active or archived motions")
        .addSubcommand(sub => sub
            .setName("active")
            .setDescription("Search the database for active motions")
            .addStringOption(option => option
                .setName("content")
                .setDescription("Search by content")
            )
            .addStringOption(option => option
                .setName("type")
                .setDescription("Search by type")
                .addChoices(
                    { name: "Senate", value: "senate" },
                    { name: "Forum", value: "forum" },
                    { name: "Both", value: "both" }
                )
            )
            .addStringOption(option => option
                .setName("before")
                .setDescription("Search before date and time (Format: YEAR-MONTH-DAY HOUR:MINUTE)")
            )
            .addStringOption(option => option
                .setName("after")
                .setDescription("Search after date and time (Format: YEAR-MONTH-DAY HOUR:MINUTE)")
            )
            .addUserOption(option => option
                .setName("author")
                .setDescription("Search by the motion's author")
            )
        )
        .addSubcommand(sub => sub
            .setName("archived")
            .setDescription("Search the database for archived motions")
            .addStringOption(option => option
                .setName("content")
                .setDescription("Search by content")
            )
            .addStringOption(option => option
                .setName("type")
                .setDescription("Search by type")
                .addChoices(
                    { name: "Senate", value: "senate" },
                    { name: "Forum", value: "forum" },
                    { name: "Both", value: "both" }
                )
            )
            .addStringOption(option => option
                .setName("before")
                .setDescription("Search before date and time (Format: YEAR-MONTH-DAY HOUR:MINUTE)")
            )
            .addStringOption(option => option
                .setName("after")
                .setDescription("Search after date and time (Format: YEAR-MONTH-DAY HOUR:MINUTE)")
            )
            .addUserOption(option => option
                .setName("author")
                .setDescription("Search by the motion's author")
            )
        )
        .addSubcommandGroup(group => group
            .setName("by")
            .setDescription("Serach for a specific motion by it's Motion ID")
            .addSubcommand(sub => sub
                .setName("id")
                .setDescription("Serach for a specific motion by it's Motion ID")
                .addStringOption(option => option
                    .setName("id")
                    .setDescription("Motion ID")
                    .setRequired(true)
                    .setMinLength(8)
                    .setMaxLength(100)
                )
            )
        )
].map((scmd) => scmd.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
await rest.put(Routes.applicationCommands(BOT_APPLICATION_ID), { body: commands });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

clientSetup(client, CONFIG);

await client.login(BOT_TOKEN)