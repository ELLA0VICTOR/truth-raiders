import { studionet } from 'genlayer-js/chains'

const DEFAULT_STUDIO_CONTRACT = '0x8911C65b9a18976EfbFfA3219707B7E5d56578B3'
const STUDIO_RPC_URL = 'https://studio.genlayer.com/api'

export const CONTRACT_ADDRESS = import.meta.env.VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS || DEFAULT_STUDIO_CONTRACT
export const GENLAYER_NETWORK = 'studionet'
export const GENLAYER_RPC_URL = STUDIO_RPC_URL
export const ACTIVE_CHAIN = studionet

export function isContractConfigured() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)
}

export async function ensureGenLayerNetwork() {
  // StudioNet is served through the Studio RPC and does not require wallet chain switching.
}
