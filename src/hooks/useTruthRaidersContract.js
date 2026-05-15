import { useCallback, useMemo, useState } from 'react'
import { createClient } from 'genlayer-js'
import { ExecutionResult, TransactionStatus } from 'genlayer-js/types'
import { ACTIVE_CHAIN, CONTRACT_ADDRESS, GENLAYER_NETWORK, GENLAYER_RPC_URL, ensureGenLayerNetwork, isContractConfigured } from '../config/genlayer'

const DEBUG_PREFIX = '[TruthRaiders:contract]'
const RECEIPT_WAIT_INTERVAL_MS = 3000
const RECEIPT_WAIT_RETRIES = 45

function isReceiptWaitTimeout(error) {
  return /Timed out waiting for transaction/i.test(error?.message || '')
}

function getFriendlyContractError(error, functionName) {
  if (isReceiptWaitTimeout(error)) {
    return 'Transaction was sent. GenLayer is still syncing it, so the app will refresh from on-chain state shortly.'
  }

  return error?.message || `Contract call failed: ${functionName}`
}

function summarizeArg(arg) {
  if (typeof arg === 'string' && arg.length > 180) {
    return `${arg.slice(0, 180)}... (${arg.length} chars)`
  }

  return arg
}

export function useTruthRaidersContract(walletAddress, roomId = 0) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const configured = isContractConfigured()
  const activeRoomId = Number.isFinite(Number(roomId)) ? Number(roomId) : 0

  const readClient = useMemo(() => {
    if (!configured) return null
    return createClient({
      chain: ACTIVE_CHAIN,
      endpoint: GENLAYER_RPC_URL,
    })
  }, [configured])

  const writeClient = useMemo(() => {
    if (!configured || !walletAddress) return null
    const provider = typeof window === 'undefined' ? undefined : window.ethereum
    return createClient({
      chain: ACTIVE_CHAIN,
      endpoint: GENLAYER_RPC_URL,
      account: walletAddress,
      provider,
    })
  }, [configured, walletAddress])

  const writeContract = useCallback(
    async (functionName, args = [], options = {}) => {
      if (!writeClient || !readClient) {
        throw new Error('Truth Raiders contract is not configured or wallet is not connected.')
      }

      const { allowPendingSync = false } = options
      setIsLoading(true)
      setError('')
      try {
        console.groupCollapsed(`${DEBUG_PREFIX} write:${functionName}`)
        console.info('contract', CONTRACT_ADDRESS)
        console.info('wallet', walletAddress)
        console.info('roomId', activeRoomId)
        console.info('args', args.map(summarizeArg))

        if (window.ethereum) {
          console.info('ensuring wallet network', GENLAYER_NETWORK)
          await ensureGenLayerNetwork(window.ethereum)
        }

        console.info('connecting write client')
        await writeClient.connect(GENLAYER_NETWORK)

        console.info('sending transaction')
        const hash = await writeClient.writeContract({
          address: CONTRACT_ADDRESS,
          functionName,
          args,
        })
        console.info('transaction hash', hash)

        console.info('waiting for ACCEPTED receipt')
        let receipt
        try {
          receipt = await readClient.waitForTransactionReceipt({
            hash,
            status: TransactionStatus.ACCEPTED,
            interval: RECEIPT_WAIT_INTERVAL_MS,
            retries: RECEIPT_WAIT_RETRIES,
            fullTransaction: false,
          })
        } catch (receiptError) {
          if (!isReceiptWaitTimeout(receiptError)) throw receiptError
          if (!allowPendingSync) throw receiptError
          console.warn('transaction wait timed out; treating as sent and letting state sync verify it', {
            hash,
            functionName,
            message: receiptError?.message,
          })
          receipt = {
            hash,
            pendingSync: true,
            message: 'Transaction sent. GenLayer is still processing it.',
          }
        }
        console.info('receipt', receipt)

        if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
          console.error('contract execution finished with error', receipt)
          throw new Error('Transaction accepted but contract execution failed.')
        }

        if (!receipt.txExecutionResultName) {
          console.info('receipt does not expose execution result yet; state reads will verify completion', receipt)
        }

        console.info('write complete', functionName)
        console.groupEnd()
        return receipt
      } catch (contractError) {
        const message = getFriendlyContractError(contractError, functionName)
        console.error(`${DEBUG_PREFIX} write failed:${functionName}`, contractError)
        console.groupEnd()
        setError(message)
        throw contractError
      } finally {
        setIsLoading(false)
      }
    },
    [activeRoomId, readClient, walletAddress, writeClient]
  )

  const readContract = useCallback(
    async (functionName, args = []) => {
      if (!readClient) {
        throw new Error('Truth Raiders contract is not configured.')
      }

      return readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        stateStatus: 'accepted',
      })
    },
    [readClient]
  )

  const getRoomById = useCallback((targetRoomId) => {
    return readContract('get_room', [Number(targetRoomId)])
  }, [readContract])

  const getRoom = useCallback(() => {
    return getRoomById(activeRoomId)
  }, [activeRoomId, getRoomById])

  const getLeaderboardById = useCallback((targetRoomId) => {
    return readContract('get_leaderboard', [Number(targetRoomId)])
  }, [readContract])

  const getLeaderboard = useCallback(() => {
    return getLeaderboardById(activeRoomId)
  }, [activeRoomId, getLeaderboardById])

  const getRoomCount = useCallback(() => {
    return readContract('get_room_count')
  }, [readContract])

  const getAdmin = useCallback(() => {
    return readContract('get_admin')
  }, [readContract])

  const isModerator = useCallback((user) => {
    return readContract('is_moderator', [user])
  }, [readContract])

  const getPackCount = useCallback(() => {
    return readContract('get_pack_count')
  }, [readContract])

  const getQuestionPack = useCallback((packId) => {
    return readContract('get_question_pack', [Number(packId)])
  }, [readContract])

  const getPackLevel = useCallback((packId, levelIndex) => {
    return readContract('get_pack_level', [Number(packId), Number(levelIndex)])
  }, [readContract])

  const getSubmission = useCallback(
    (roundId, player) => {
      return readContract('get_submission', [activeRoomId, roundId, player])
    },
    [activeRoomId, readContract]
  )

  const getSubmissionStatus = useCallback(
    (roundId, player) => {
      return readContract('get_submission_status', [activeRoomId, roundId, player])
    },
    [activeRoomId, readContract]
  )

  const createRoom = useCallback(
    (seasonCode, roomCode, roundCount, xpPool, durationMinutes) => {
      return writeContract('create_room', [seasonCode, roomCode, roundCount, xpPool, Number(durationMinutes)], { allowPendingSync: true })
    },
    [writeContract]
  )

  const createRoomFromPack = useCallback(
    (packId, roomCode, xpPool, durationMinutes) => {
      return writeContract('create_room_from_pack', [Number(packId), roomCode, xpPool, Number(durationMinutes)], { allowPendingSync: true })
    },
    [writeContract]
  )

  const startRoom = useCallback(
    () => {
      return writeContract('start_room', [activeRoomId], { allowPendingSync: true })
    },
    [activeRoomId, writeContract]
  )

  const addModerator = useCallback(
    (user) => {
      return writeContract('admin_add_moderator', [user])
    },
    [writeContract]
  )

  const removeModerator = useCallback(
    (user) => {
      return writeContract('admin_remove_moderator', [user])
    },
    [writeContract]
  )

  const createQuestionPack = useCallback(
    (title, seasonCode) => {
      return writeContract('create_question_pack', [title, seasonCode])
    },
    [writeContract]
  )

  const setPackLevel = useCallback(
    (packId, levelIndex, label, title, prompt, levelJson, answerKey, evidenceUrls, scoring) => {
      return writeContract('set_pack_level', [
        Number(packId),
        Number(levelIndex),
        label,
        title,
        prompt,
        levelJson,
        answerKey,
        evidenceUrls,
        scoring,
      ])
    },
    [writeContract]
  )

  const publishQuestionPack = useCallback(
    (packId) => {
      return writeContract('publish_question_pack', [Number(packId)])
    },
    [writeContract]
  )

  const joinRoom = useCallback(
    (handle) => {
      return writeContract('join_room', [activeRoomId, handle, 'scribe'], { allowPendingSync: true })
    },
    [activeRoomId, writeContract]
  )

  const submitRound = useCallback(
    (roundId, chamber, answer, evidenceUrl) => {
      return writeContract('submit_round', [activeRoomId, roundId, chamber, answer, evidenceUrl])
    },
    [activeRoomId, writeContract]
  )

  const scoreRound = useCallback(
    (roundId, player, prompt, rubricCsv) => {
      return writeContract('score_round', [activeRoomId, roundId, player, prompt, rubricCsv])
    },
    [activeRoomId, writeContract]
  )

  const finalizeRoom = useCallback(() => {
    return writeContract('finalize_room', [activeRoomId])
  }, [activeRoomId, writeContract])

  return {
    configured,
    contractAddress: CONTRACT_ADDRESS,
    roomId: activeRoomId,
    isLoading,
    error,
    getRoom,
    getRoomById,
    getLeaderboard,
    getLeaderboardById,
    getRoomCount,
    getAdmin,
    isModerator,
    getPackCount,
    getQuestionPack,
    getPackLevel,
    getSubmission,
    getSubmissionStatus,
    createRoom,
    createRoomFromPack,
    startRoom,
    addModerator,
    removeModerator,
    createQuestionPack,
    setPackLevel,
    publishQuestionPack,
    joinRoom,
    submitRound,
    scoreRound,
    finalizeRoom,
  }
}
