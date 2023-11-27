import dotenv from "dotenv";
import { ethers, Contract } from "ethers";
import { InfuraProvider } from "ethers";
import abiData from "./gov_abi.json";
import { Cast, ApiResponse } from "./interfaces";
import { findNftOwners } from "./nft_owners";

dotenv.config();

// Environment variables and configurations
const INFURA_PROJ_ID = process.env.INFURA_PROJ_ID;
const NEYNAR_KEY = process.env.NEYNAR_KEY;
const CHAIN = process.env.CHAIN || "goerli";
const GOV_CONTRACT_ADDRESS = process.env.GOVERNANCE_CONTRACT_ADDRESS || "";
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || "";
const FID = process.env.BOT_FID || "";
const NEYNAR_SIGNER = process.env.NEYNAR_SIGNER || "";
const DEV_MODE_NO_TAG = process.env.DEV_MODE_NO_TAG !== "False";

if (!INFURA_PROJ_ID || !NEYNAR_KEY || !GOV_CONTRACT_ADDRESS || !FID) {
  throw new Error("API keys are undefined. Please check your .env file.");
}

// Headers for API requests
const headers = {
  accept: "application/json",
  api_key: NEYNAR_KEY,
  "content-type": "application/json",
};

// Parse the ABI and setup the contract
const govAbi = JSON.parse(abiData.result);
const provider = new InfuraProvider(CHAIN, INFURA_PROJ_ID);
const contract = new Contract(GOV_CONTRACT_ADDRESS, govAbi, provider);

let proposalCount = 0;

// Fetch historical proposals
async function fetchHistoricalProposals() {
  const filter = contract.filters.ProposalCreated();
  const events = await contract.queryFilter(filter);
  const proposals = events.map((event) => ({
    number: ++proposalCount,
    url: `https://nouns.build/dao/ethereum/${NFT_CONTRACT_ADDRESS}/vote/${proposalCount}`,
  }));

  return proposals;
}

async function fetchAllCasts(fid: string): Promise<Cast[]> {
  let url: string = `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fid=${fid}&fids=${fid}&with_recasts=false&limit=100`;
  let allCasts: Cast[] = [];

  while (url) {
    try {
      const response = await fetch(url, { method: "GET", headers: headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiResponse = await response.json();

      allCasts = [...allCasts, ...data.casts];

      if (data.next && data.next.cursor) {
        url = `https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fid=${fid}&fids=${fid}&with_recasts=false&limit=100&cursor=${data.next.cursor}`;
      } else {
        url = ""; // Stop the loop if there's no next cursor
      }
    } catch (error) {
      console.error(`Failed to fetch data: ${error}`);
      break; // Exit the loop in case of an error
    }
  }

  return allCasts;
}

async function postCast(text: string, url: string) {
  // Post the initial cast
  let response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      signer_uuid: NEYNAR_SIGNER,
      text: text,
      embeds: [{ url: url }],
    }),
  });

  let result = await response.json();
  console.log(`Posted cast for proposal ${text}:`, result);

  if (DEV_MODE_NO_TAG == false) {
    // Extract the hash of the initial cast
    const parentHash = result.cast.hash;

    //Post the "tagging all members below" cast as a reply
    response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        signer_uuid: NEYNAR_SIGNER,
        text: "tagging all members below",
        parent: parentHash,
      }),
    });

    const replyResult = await response.json();
    const replyHash = replyResult.cast.hash;

    // Get NFT owners
    const nftOwners = await findNftOwners();

    // Create batches of up to 5 usernames
    const usernames = Array.from(nftOwners);
    for (let i = 0; i < usernames.length; i += 5) {
      const batch = usernames.slice(i, i + 5);

      // Post each batch as a reply to the "tagging all members below" cast
      const taggingText = batch.map((username) => `@${username}`).join(" ");
      await fetch("https://api.neynar.com/v2/farcaster/cast", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          signer_uuid: NEYNAR_SIGNER,
          text: taggingText,
          parent: replyHash,
        }),
      });
    }
  }
}

// Define a delay function
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processProposals() {
  const historicalProposals = await fetchHistoricalProposals();
  const casts = await fetchAllCasts(FID);

  const postedUrls = casts.flatMap(
    (cast) => cast.embeds?.map((embed) => embed.url) ?? []
  );

  for (const proposal of historicalProposals) {
    if (!postedUrls.includes(proposal.url)) {
      await postCast(
        `Purple proposal #${proposal.number} is live`,
        proposal.url
      );

      // Wait for a specified time before posting the next cast
      await delay(2000); // Delay for 2000 milliseconds (2 second)
    }
  }
}

// Listen for new proposals
async function listenForNewProposals() {
  contract.on("ProposalCreated", async () => {
    proposalCount++;
    const proposalUrl = `https://nouns.build/dao/ethereum/${NFT_CONTRACT_ADDRESS}/vote/${proposalCount}`;
    const casts = await fetchAllCasts(FID);

    const hasBeenPosted = casts.some((cast) =>
      cast.embeds?.some((embed) => embed.url === proposalUrl)
    );

    if (!hasBeenPosted) {
      await postCast(`Purple proposal #${proposalCount} is live`, proposalUrl);
    }
  });
}

// Initialize the process
processProposals().then(() => {
  console.log(`Fetched ${proposalCount} historical proposals.`);
  listenForNewProposals();
});
