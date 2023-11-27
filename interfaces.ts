export interface Cast {
  object: string;
  hash: string;
  thread_hash: string;
  parent_hash: string | null;
  parent_url: string | null;
  parent_author: {
    fid: string | null;
  };
  author: {
    object: string;
    fid: number;
    custody_address: string;
    username: string;
    display_name: string;
    pfp_url: string;
    profile: {
      bio: {
        text: string;
        mentioned_profiles: any[];
      };
    };
    follower_count: number;
    following_count: number;
    verifications: any[];
    active_status: string;
  };
  text: string;
  timestamp: string;
  embeds: any[];
  reactions: {
    likes: any[];
    recasts: any[];
  };
  replies: {
    count: number;
  };
  mentioned_profiles: any[];
}

export interface ApiResponse {
  casts: Cast[];
  next: {
    cursor: string | null;
  };
}

export interface UserProfileResponse {
  result: {
    user: {
      fid: number;
      custodyAddress: string;
      username: string;
      displayName: string;
      pfp: {
        url: string;
      };
      profile: {
        bio: {
          text: string;
          mentionedProfiles: any[]; // Replace 'any' with a more specific type if available
        };
      };
      followerCount: number;
      followingCount: number;
      verifications: string[];
      activeStatus: "active" | "inactive"; // Assuming activeStatus can be 'active' or 'inactive'
    };
  };
}
