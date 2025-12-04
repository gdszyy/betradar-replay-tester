CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` varchar(128) NOT NULL,
	`name` text,
	`sportType` varchar(64),
	`scheduledTime` timestamp,
	`status` varchar(32),
	`homeTeam` text,
	`awayTeam` text,
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matches_id` PRIMARY KEY(`id`),
	CONSTRAINT `matches_matchId_unique` UNIQUE(`matchId`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int,
	`matchId` varchar(128),
	`messageType` varchar(64) NOT NULL,
	`producer` varchar(64),
	`messageTimestamp` timestamp,
	`routingKey` text,
	`rawContent` text,
	`parsedData` text,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replay_playlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`matchId` varchar(128) NOT NULL,
	`playOrder` int DEFAULT 0,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replay_playlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replay_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionName` varchar(255),
	`status` varchar(32) NOT NULL DEFAULT 'idle',
	`speed` int DEFAULT 10,
	`maxDelay` int DEFAULT 10000,
	`nodeId` varchar(64),
	`productId` int,
	`startedBy` int,
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `replay_sessions_id` PRIMARY KEY(`id`)
);
