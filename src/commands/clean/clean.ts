import { Command, SafetyJim } from '../../safetyjim/safetyjim';
import * as Discord from 'discord.js';

interface SeperatedMessages {
    oldMessages: Discord.Message[];
    newMessages: Discord.Message[];
}

class Clean implements Command {
    public usage = [
        'clean - deletes one message',
        'clean <number> @user - deletes number of messages from specified user',
        'clean <number> bot - deletes number of messages sent from bots'];

    // tslint:disable-next-line:no-empty
    constructor(bot: SafetyJim) {}

    public async run(bot: SafetyJim, msg: Discord.Message, args: string): Promise<boolean> {
        let newArgs = args.split(' ');
        let deleteAmount = parseInt(newArgs[0]);

        if (!msg.member.hasPermission('MANAGE_MESSAGES')) {
            await bot.failReact(msg);
            await msg.channel.send('You don\'t have enough permissions to execute this command!');
            return;
        }

        if (!msg.guild.me.hasPermission('MANAGE_MESSAGES')) {
            await bot.failReact(msg);
            await msg.channel.send('I don\'t have enough permissions to do that!');
            return;
        }

        if (newArgs[0] === '' && newArgs.length === 1) {
            await msg.channel.bulkDelete(2);
            return;
        }

        if (isNaN(deleteAmount)) {
            return true;
        }

        if (deleteAmount < 1) {
            await bot.failReact(msg);
            await msg.channel.send('You can\'t delete zero or negative messages.');
            return;
        }

        if (deleteAmount > 100) {
            await bot.failReact(msg);
            await msg.channel.send('You can\'t delete more than 100 messages.');
            return;
        }

        if (!newArgs[1]) {
            deleteAmount = (deleteAmount === 100) ? 100 : (deleteAmount + 1);
            let messages = await msg.channel.fetchMessages({ limit: deleteAmount });
            await this.deleteBulk(this.seperateMessages(messages), msg);
            return;
        }

        if (!newArgs[1].match(Discord.MessageMentions.USERS_PATTERN) &&
            newArgs[1].toLowerCase() !== 'bot') {
                await bot.failReact(msg);
                return true;
        }

        if (newArgs[1].match(Discord.MessageMentions.USERS_PATTERN)) {
            let deleteUser = msg.mentions.users.first();

            if (deleteUser.id === msg.author.id) {
                deleteAmount = (deleteAmount === 100) ? 100 : (deleteAmount + 1);
            }

            let messages = await msg.channel.fetchMessages({ limit: 100 });
            const newMessages = messages.filterArray((m) => m.author.id === msg.mentions.users.first().id)
                .slice(0, deleteAmount);

            await this.deleteBulk(this.seperateMessages(newMessages), msg);
            if (deleteUser.id === msg.author.id) {
                await bot.successReact(msg);
            }
            return;
        }

        if (newArgs[1].toLowerCase() === 'bot') {
            let messages = await msg.channel.fetchMessages({ limit: 100 });
            const newMessages = messages.filterArray((m) => m.author.bot)
                .slice(0, deleteAmount);

            await this.deleteBulk(this.seperateMessages(newMessages), msg);
            await bot.successReact(msg);
            return;
        }
        return;
    }

    // tslint:disable-next-line:max-line-length
    private seperateMessages(messages: Discord.Collection<string, Discord.Message> | Discord.Message[]): SeperatedMessages {
        let result = { oldMessages: [], newMessages: [] } as SeperatedMessages;
        let newMessages = (messages instanceof Array) ? messages : Array.from(messages.values());

        for (let message of newMessages) {
            if ((Date.now() - message.createdAt.getTime()) >= 1000 * 60 * 60 * 24 * 15) {
                result.oldMessages.push(message);
            } else {
                result.newMessages.push(message);
            }
        }

        return result;
    }

    private async deleteBulk(messages: SeperatedMessages, msg: Discord.Message): Promise<void> {
        if (messages.newMessages.length >= 2 && messages.newMessages.length <= 100) {
            await msg.channel.bulkDelete(messages.newMessages);
        } else {
            for (let message of messages.newMessages) {
                await message.delete();
            }
        }

        await Promise.all(messages.oldMessages.map((m) => m.delete()));
    }
}
export = Clean;
