export type ApiAuthor =
	| {
			avatarUrl: string;
			fullname: string;
			name: string;
			isHf: boolean;
			isHfAdmin: boolean;
			isMod: boolean;
			followerCount?: number;
			type: "org";
			isEnterprise: boolean;
			isUserFollowing?: boolean;
	  }
	| {
			avatarUrl: string;
			fullname: string;
			name: string;
			isHf: boolean;
			isHfAdmin: boolean;
			isMod: boolean;
			followerCount?: number;
			type: "user";
			isPro: boolean;
			_id: string;
			isUserFollowing?: boolean;
	  };
