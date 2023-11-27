import { ethers, Contract, EventLog } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const INFURA_PROJ_ID = process.env.INFURA_PROJ_ID || "";
const NEYNAR_KEY = process.env.NEYNAR_KEY || "";
const CHAIN = process.env.CHAIN || "goerli";
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || "";

if (!INFURA_PROJ_ID || !NEYNAR_KEY || !NFT_CONTRACT_ADDRESS) {
  throw new Error(
    "One or more required environment variables are missing. Please check your .env file."
  );
}

const provider = new ethers.InfuraProvider(CHAIN, INFURA_PROJ_ID);

const nftAbi = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const nftContract = new Contract(NFT_CONTRACT_ADDRESS, nftAbi, provider);

export async function findNftOwners(): Promise<Set<string>> {
  try {
    const filter = nftContract.filters.Transfer(null, null);
    const events = await nftContract.queryFilter(filter);

    const ownersSet = new Set<string>();
    const usernamesSet = new Set<string>();

    for (const event of events) {
      if (event instanceof EventLog) {
        ownersSet.add(event.args.to);
      }
    }

    for (const address of ownersSet) {
      const headers: Record<string, string> = {
        accept: "application/json",
        api_key: NEYNAR_KEY,
      };

      const response = await fetch(
        `https://api.neynar.com/v1/farcaster/user-by-verification?address=${address}`,
        {
          method: "GET",
          headers: headers,
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.result.user) {
          usernamesSet.add(data.result.user.username);
        }
      } else {
        continue;
      }
    }

    return usernamesSet;
  } catch (error) {
    console.error("Error:", error);
    return new Set<string>(); // Return an empty set in case of an error
  }
}
