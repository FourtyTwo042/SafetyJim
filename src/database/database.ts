import * as sqlite from 'sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../config/config';
import { User, Guild } from 'discord.js';
import * as winston from 'winston';

function getSqlStatementFromFile(sqlFileName: string): string {
    return fs.readFileSync(path.join(__dirname, 'sql', sqlFileName)).toString();
}

export class BotDatabase {
    private database: sqlite.Database;
    private sqlStatements;
    constructor(private config: Config, private log: winston.LoggerInstance) {
        this.sqlStatements = {
            createUserBan: getSqlStatementFromFile('createUserBan.sql'),
        };
    }

    // TODO (sam): This function doesn't need to return anything,
    // try to fix this later.
    public async init(): Promise<BotDatabase> {
        this.database = await sqlite.open(this.config.dbFileName);

        await this.database.run(`CREATE TABLE IF NOT EXISTS BanList (
                                    BannedUserID      TEXT,
                                    BannedUserName    TEXT,
                                    ModeratorID       TEXT,
                                    ModeratorUserName TEXT,
                                    GuildID           TEXT,
                                    BanTime           INTEGER,
                                    ExpireTime        INTEGER,
                                    Reason            TEXT,
                                    Expires           BOOLEAN);`)
                                    .catch((err) => { this.log.error('Could not create BanList table!'); });

        await this.database.run('CREATE INDEX IF NOT EXISTS "" ON BanList (ModeratorID, GuildID, BannedUserID);')
                           .catch((err) => { this.log.error('Could not create index for Banlist table!'); });
        await this.database.run('CREATE TABLE IF NOT EXISTS PrefixList (GuildID TEXT, Prefix TEXT);')
                           .catch((err) => { this.log.error('Could not create PrefixList table!'); });

        // seriously, fix this.
        return Promise.resolve(this);
    }

    public getModeratorsBans(modID: string, guildID: string): Promise<BanRecord[]> {
        return this.database.all('SELECT * FROM BanList WHERE ModeratorID = ? AND GuildID = ?;', modID, guildID)
            .then((rows) => rows as BanRecord[])
            .catch((err) => { this.log.error('Could not retrieve moderator ban records!'); });
    }

    public getGuildBans(guildID: string): Promise<BanRecord[]> {
        return this.database.all('SELECT * FROM BanList WHERE GuildID = ?;', guildID)
            .then((rows) => rows as BanRecord[])
            .catch((err) => { this.log.error('Could not retrieve guild ban records!'); });
    }

    public getUserBan(userID: string, guildID: string): Promise<BanRecord> {
        return this.database.get('SELECT * FROM BanList WHERE GuildID = ? and BannedUserID = ?;', guildID, userID)
            .then((row) => row as BanRecord)
            .catch((err) => { this.log.error('Could not retrieve user ban record!'); });
    }

    public getExpiredBans(): Promise<BanRecord[]> {
        return this.database.all('SELECT * FROM BanList WHERE ExpireTime < (strftime(\'%s\',\'now\')) and Expires = 1;')
            .then((rows) => rows as BanRecord[])
            .catch((err) => { this.log.error('Could not retrieve expired ban records!'); });
    }

    public getGuildPrefix(guild: Guild): Promise<PrefixRecord> {
        return this.database.get('SELECT Prefix from PrefixList WHERE GuildID = ?', guild.id)
            .catch((err) => { this.log.error('Could not retrieve prefix record!'); });
    }

    public updateGuildPrefix(guild: Guild, newPrefix: string): void {
        this.database.run('UPDATE PrefixList SET Prefix = ? WHERE GuildID = ?', newPrefix, guild.id)
            .catch((err) => { this.log.error('Could not update prefix record!'); });
    }

    public delGuildPrefix(guild: Guild): void {
        this.database.run('DELETE FROM PrefixList WHERE GuildID = ?', guild.id)
            .catch((err) => { this.log.error('Could not delete prefix record!'); });
    }

    public createGuildPrefix(guild: Guild, prefix: string): void {
        this.database.run('INSERT INTO PrefixList (GuildID, Prefix) VALUES (?, ?);', guild.id, prefix)
            .catch((err) => { this.log.error('Could not create prefix record!'); });
    }

    public delUserBan(userID: string, guildID: string): void {
        this.database.run('DELETE FROM BanList WHERE UserID = ? AND GuildID = ?;', userID, guildID)
            .catch((err) => { this.log.error('Could not delete ban record!'); });
    }

    public createUserBan(bannedUser: User,
                         modUser: User,
                         guild: Guild,
                         reason: string,
                         expireTime?: number): void {
        let expires = true;

        if (expireTime == null) {
            expires = false;
            expireTime = 0;
        }

        this.database.run(this.sqlStatements.createUserBan,
                          bannedUser.id,
                          bannedUser.username + bannedUser.discriminator,
                          modUser.id,
                          modUser.username + modUser.discriminator,
                          guild.id,
                          (new Date()).getSeconds(),
                          expireTime,
                          reason,
                          expires)
                      .catch((err) => { this.log.error('Could not create a ban record!'); });
    }
}

interface BanRecord {
    BannedUserID: string;
    BannedUserName: string;
    ModeratorID: string;
    ModeratorUserName: string;
    GuildID: string;
    BanTime: number;
    ExpireTime: number;
    Reason: string;
    Expires: boolean;
}

interface PrefixRecord {
    Prefix: string;
}