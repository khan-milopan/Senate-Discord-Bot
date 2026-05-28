import { WebhookClient, EmbedBuilder } from "discord.js";

let avatarUrl: any;
let username: string;
let webhook: WebhookClient;
let notifiedRoleId: any;
let whEnabled: boolean;

export async function webhookInit(
    avatar: any,
    notificationConfig: any,
    url: string
) {
    avatarUrl = avatar

    username = notificationConfig.webhookName;

    if (url.startsWith("https://discord.com/api/webhooks/")) {
        webhook = new WebhookClient({ url: url })
    } else {
        console.log("Webhook URL error: " + url)
    }

    if (notificationConfig.notifiedRoleId !== "") {
        notifiedRoleId = notificationConfig.notifiedRoleId
    } else {
        notifiedRoleId = undefined
    }

    whEnabled = notificationConfig.enable
};

export async function webhookSend(content: string) {
    if (whEnabled) {
        await webhook.send({
            content: `<@&${notifiedRoleId}>`,
            username: username,
            ...(typeof avatarUrl === "string" && {avatarURL: avatarUrl}),
            embeds: [
                new EmbedBuilder()
                    .setTitle("Notification!")
                    .setDescription(content)
                    .setTimestamp()
                    .setColor(0x000000)
            ]
        })
    }
}