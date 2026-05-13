import { localnet, studionet, testnetAsimov, testnetBradbury } from 'genlayer-js/chains'

export const CONTRACT_ADDRESS = import.meta.env.VITE_TRUTH_RAIDERS_CONTRACT_ADDRESS || ''
export const ROOM_ID = Number(import.meta.env.VITE_TRUTH_RAIDERS_ROOM_ID || 0)
export const GENLAYER_NETWORK = import.meta.env.VITE_GENLAYER_NETWORK || 'studionet'

const CHAINS = {
  localnet,
  studionet,
  asimov: testnetAsimov,
  bradbury: testnetBradbury,
}

export const ACTIVE_CHAIN = CHAINS[GENLAYER_NETWORK] || studionet

export function isContractConfigured() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)
}
