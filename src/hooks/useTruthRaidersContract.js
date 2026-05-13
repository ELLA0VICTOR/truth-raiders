import { useCallback, useMemo, useState } from 'react'
import { createClient } from 'genlayer-js'
import { ACTIVE_CHAIN, CONTRACT_ADDRESS, ROOM_ID, isContractConfigured } from '../config/genlayer'
import { RAID_SEASON } from '../data/raidContent'

export function useTruthRaidersContract(walletAddress) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const configured = isContractConfigured()

  const client = useMemo(() => {
    if (!configured || !walletAddress) return null
    return createClient({
      chain: ACTIVE_CHAIN,
      account: walletAddress,
    })
  }, [configured, walletAddress])

  const writeContract = useCallback(
    async (functionName, args = []) => {
      if (!client) {
        throw new Error('Truth Raiders contract is not configured or wallet is not connected.')
      }

      setIsLoading(true)
      setError('')
      try {
        const hash = await client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName,
          args,
        })

        const receipt = await client.waitForTransactionReceipt({
          hash,
          status: 'FINALIZED',
          interval: 5000,
          retries: 36,
        })

        return receipt
      } catch (contractError) {
        const message = contractError?.message || `Contract call failed: ${functionName}`
        setError(message)
        throw contractError
      } finally {
        setIsLoading(false)
      }
    },
    [client]
  )

  const readContract = useCallback(
    async (functionName, args = []) => {
      if (!client) {
        throw new Error('Truth Raiders contract is not configured or wallet is not connected.')
      }

      return client.readContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
      })
    },
    [client]
  )

  const getRoom = useCallback(() => {
    return readContract('get_room', [ROOM_ID])
  }, [readContract])

  const createRoom = useCallback(() => {
    return writeContract('create_room', [RAID_SEASON.code, RAID_SEASON.roomCode, 5, RAID_SEASON.xpPool])
  }, [writeContract])

  const joinRoom = useCallback(
    (handle) => {
      return writeContract('join_room', [ROOM_ID, handle, 'scribe'])
    },
    [writeContract]
  )

  const submitRound = useCallback(
    (roundId, chamber, answer, evidenceUrl) => {
      return writeContract('submit_round', [ROOM_ID, roundId, chamber, answer, evidenceUrl])
    },
    [writeContract]
  )

  const scoreRound = useCallback(
    (roundId, player, prompt, rubricCsv) => {
      return writeContract('score_round', [ROOM_ID, roundId, player, prompt, rubricCsv])
    },
    [writeContract]
  )

  const finalizeRoom = useCallback(() => {
    return writeContract('finalize_room', [ROOM_ID])
  }, [writeContract])

  return {
    configured,
    contractAddress: CONTRACT_ADDRESS,
    roomId: ROOM_ID,
    isLoading,
    error,
    getRoom,
    createRoom,
    joinRoom,
    submitRound,
    scoreRound,
    finalizeRoom,
  }
}
