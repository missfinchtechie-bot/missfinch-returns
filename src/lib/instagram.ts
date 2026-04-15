const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
const ACTOR_ID = 'shu8hvrXbJbY3Eb9W';

type LatestPost = {
  url?: string;
  likesCount?: number;
  commentsCount?: number;
  type?: string;
};

export type InstagramProfile = {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  isVerified: boolean;
  isBusinessAccount: boolean;
  profilePicUrl: string;
  externalUrl: string;
  recentPosts: { url: string; likesCount: number; commentsCount: number; type: string }[];
  engagementRate: number;
};

export async function scrapeInstagramProfile(handle: string): Promise<InstagramProfile | null> {
  if (!APIFY_TOKEN) return null;
  const cleanHandle = handle.replace(/^@/, '').trim();
  if (!cleanHandle) return null;

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/${cleanHandle}/`],
          resultsType: 'details',
          resultsLimit: 1,
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const profile = data[0];
    const latest: LatestPost[] = Array.isArray(profile.latestPosts) ? profile.latestPosts.slice(0, 12) : [];

    let engagementRate = 0;
    if (latest.length > 0 && profile.followersCount > 0) {
      const total = latest.reduce((s, p) => s + (Number(p.likesCount) || 0) + (Number(p.commentsCount) || 0), 0);
      engagementRate = (total / latest.length / profile.followersCount) * 100;
    }

    return {
      username: profile.username || cleanHandle,
      fullName: profile.fullName || '',
      biography: profile.biography || '',
      followersCount: Number(profile.followersCount) || 0,
      followsCount: Number(profile.followsCount) || 0,
      postsCount: Number(profile.postsCount) || 0,
      isVerified: !!profile.verified,
      isBusinessAccount: !!profile.isBusinessAccount,
      profilePicUrl: profile.profilePicUrl || '',
      externalUrl: profile.externalUrl || '',
      recentPosts: latest.map(p => ({
        url: p.url || '',
        likesCount: Number(p.likesCount) || 0,
        commentsCount: Number(p.commentsCount) || 0,
        type: p.type || 'Image',
      })),
      engagementRate: Math.round(engagementRate * 100) / 100,
    };
  } catch (e) {
    console.error('Apify scrape error:', e);
    return null;
  }
}
