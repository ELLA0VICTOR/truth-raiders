import { studionet } from 'genlayer-js/chains'

const DEFAULT_STUDIO_CONTRACT = '0x421CADf25302f070010cF1e22F52D219958b3E76'
const STUDIO_RPC_URL = 'https://studio.genlayer.com/api'

export const CONTRACT_ADDRESS = import.meta.env.VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS || DEFAULT_STUDIO_CONTRACT
export const ROOM_ID = Number(import.meta.env.VITE_TRUTH_RAIDERS_ROOM_ID || 0)
export const GENLAYER_NETWORK = 'studionet'
export const GENLAYER_RPC_URL = STUDIO_RPC_URL
export const ACTIVE_CHAIN = studionet

export function isContractConfigured() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)
}

export async function ensureGenLayerNetwork() {
  // StudioNet is served through the Studio RPC and does not require wallet chain switching.
}
