# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from dataclasses import dataclass
import json
import typing

from genlayer import *


MAX_ROOM_PLAYERS = 8
MAX_ROUNDS = 5
MAX_TEXT = 1200
MAX_URL = 220
MAX_LEADERBOARD = 16
MAX_AUDIT = 80
ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"


def clean(value: str, limit: int) -> str:
    return value.strip()[:limit]


def require_text(value: str, label: str, limit: int) -> str:
    result = clean(value, limit)
    if result == "":
        raise gl.vm.UserError(f"{ERROR_EXPECTED} {label} is required")
    return result


def validate_url(url: str) -> str:
    result = clean(url, MAX_URL)
    if result == "":
        return ""
    if " " in result:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Evidence URL cannot contain spaces")
    if not (result.startswith("https://") or result.startswith("http://")):
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Evidence URL must start with http:// or https://")
    return result


def parse_json(raw_response: typing.Any) -> dict:
    if isinstance(raw_response, str):
        return json.loads(raw_response.replace("```json", "").replace("```", "").strip())
    return raw_response


def clamp_score(value: typing.Any) -> int:
    score = int(value)
    if score < 0:
        return 0
    if score > 100:
        return 100
    return score


def normalize_bool(value: typing.Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        return lowered in ["true", "yes", "accepted", "pass"]
    return bool(value)


def normalize_score(raw_response: typing.Any) -> dict:
    parsed = parse_json(raw_response)
    score = clamp_score(parsed.get("score", 0))
    accepted = normalize_bool(parsed.get("accepted", False)) and score >= 55
    return {
        "score": score,
        "accepted": accepted,
        "reason": clean(str(parsed.get("reason", "No reason provided")), 240),
        "xp_award": score if accepted else 0,
    }


def valid_score_payload(payload: dict) -> bool:
    score = clamp_score(payload.get("score", 0))
    xp_award = clamp_score(payload.get("xp_award", 0))
    reason = clean(str(payload.get("reason", "")), 240)
    accepted = normalize_bool(payload.get("accepted", False))
    if reason == "":
        return False
    if not accepted and xp_award > 0:
        return False
    if accepted and xp_award != score:
        return False
    if accepted and score < 55:
        return False
    return score >= 0 and score <= 100 and xp_award >= 0 and xp_award <= 100


def close_enough(left: int, right: int) -> bool:
    distance = left - right
    if distance < 0:
        distance = distance * -1
    return distance <= 12


@allow_storage
@dataclass
class PlayerRecord:
    wallet: Address
    handle: str
    avatar: str
    xp: u256
    joined_at: str


@allow_storage
@dataclass
class RoomRecord:
    id: u256
    season_code: str
    room_code: str
    host: Address
    status: str
    player_count: u256
    round_count: u256
    xp_pool: u256
    created_at: str
    finalized_at: str


@allow_storage
@dataclass
class SubmissionRecord:
    room_id: u256
    round_id: u8
    player: Address
    chamber: str
    answer: str
    evidence_url: str
    score: u8
    xp_award: u256
    accepted: bool
    reason: str
    submitted_at: str
    scored_at: str


@allow_storage
@dataclass
class AuditEvent:
    timestamp: str
    actor: Address
    action: str
    target_id: u256
    details: str


class TruthRaiders(gl.Contract):
    rooms: TreeMap[u256, RoomRecord]
    room_players: TreeMap[u256, DynArray[PlayerRecord]]
    room_submissions: TreeMap[u256, DynArray[SubmissionRecord]]
    audit_log: DynArray[AuditEvent]
    next_room_id: u256
    admin: Address

    def __init__(self, admin: Address):
        self.admin = admin
        self.audit_log = []
        self.next_room_id = u256(0)

    def _room_key(self, room_id: int) -> u256:
        key = u256(room_id)
        if key not in self.rooms:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Room does not exist")
        return key

    def _get_room_players(self, room_id: u256) -> DynArray[PlayerRecord]:
        if room_id in self.room_players:
            return self.room_players[room_id]
        return []

    def _get_room_submissions(self, room_id: u256) -> DynArray[SubmissionRecord]:
        if room_id in self.room_submissions:
            return self.room_submissions[room_id]
        return []

    def _find_player_index(self, players: DynArray[PlayerRecord], player: Address) -> int:
        for index in range(len(players)):
            if players[index].wallet == player:
                return index
        return -1

    def _find_submission_index(self, submissions: DynArray[SubmissionRecord], round_id: int, player: Address) -> int:
        for index in range(len(submissions)):
            submission = submissions[index]
            if int(submission.round_id) == round_id and submission.player == player:
                return index
        return -1

    def _append_audit(self, actor: Address, action: str, target_id: u256, details: str):
        log = self.audit_log
        log.append(
            AuditEvent(
                timestamp=gl.message_raw["datetime"],
                actor=actor,
                action=action,
                target_id=target_id,
                details=clean(details, 240),
            )
        )
        while len(log) > MAX_AUDIT:
            log.pop(0)
        self.audit_log = log

    @gl.public.write
    def create_room(self, season_code: str, room_code: str, round_count: int, xp_pool: int):
        if round_count <= 0 or round_count > MAX_ROUNDS:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid round count")
        if xp_pool <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} XP pool must be positive")

        room_id = self.next_room_id
        room = RoomRecord(
            id=room_id,
            season_code=require_text(season_code, "Season code", 96),
            room_code=require_text(room_code, "Room code", 32),
            host=gl.message.sender_address,
            status="open",
            player_count=u256(0),
            round_count=u256(round_count),
            xp_pool=u256(xp_pool),
            created_at=gl.message_raw["datetime"],
            finalized_at="",
        )

        self.rooms[room_id] = room
        self.next_room_id = u256(int(room_id) + 1)
        self._append_audit(gl.message.sender_address, "ROOM_CREATED", room_id, room.room_code)

    @gl.public.write
    def join_room(self, room_id: int, handle: str, avatar: str):
        key = self._room_key(room_id)
        room = self.rooms[key]
        if room.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Room is not open")

        players = self._get_room_players(key)
        if self._find_player_index(players, gl.message.sender_address) >= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Player already joined")
        if int(room.player_count) >= MAX_ROOM_PLAYERS:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Room is full")

        player = PlayerRecord(
            wallet=gl.message.sender_address,
            handle=require_text(handle, "Handle", 32),
            avatar=require_text(avatar, "Avatar", 32),
            xp=u256(0),
            joined_at=gl.message_raw["datetime"],
        )

        players.append(player)
        self.room_players[key] = players

        room.player_count = u256(int(room.player_count) + 1)
        self.rooms[key] = room
        self._append_audit(gl.message.sender_address, "PLAYER_JOINED", key, player.handle)

    @gl.public.write
    def submit_round(self, room_id: int, round_id: int, chamber: str, answer: str, evidence_url: str):
        key = self._room_key(room_id)
        room = self.rooms[key]
        if room.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Room is not open")
        if round_id < 0 or round_id >= int(room.round_count):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid round")

        players = self._get_room_players(key)
        if self._find_player_index(players, gl.message.sender_address) < 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Player has not joined")

        submissions = self._get_room_submissions(key)
        if self._find_submission_index(submissions, round_id, gl.message.sender_address) >= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Player already submitted this round")

        submission = SubmissionRecord(
            room_id=key,
            round_id=u8(round_id),
            player=gl.message.sender_address,
            chamber=require_text(chamber, "Chamber", 48),
            answer=require_text(answer, "Answer", MAX_TEXT),
            evidence_url=validate_url(evidence_url),
            score=u8(0),
            xp_award=u256(0),
            accepted=False,
            reason="Awaiting GenLayer scoring",
            submitted_at=gl.message_raw["datetime"],
            scored_at="",
        )

        submissions.append(submission)
        self.room_submissions[key] = submissions
        self._append_audit(gl.message.sender_address, "ROUND_SUBMITTED", key, submission.chamber)

    @gl.public.write
    def score_round(self, room_id: int, round_id: int, player: Address, prompt: str, rubric_csv: str):
        key = self._room_key(room_id)
        submissions = self._get_room_submissions(key)
        submission_index = self._find_submission_index(submissions, round_id, player)
        if submission_index < 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Submission does not exist")

        submission = submissions[submission_index]
        if submission.scored_at != "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Submission already scored")

        room_memory = gl.storage.copy_to_memory(self.rooms[key])
        submission_memory = gl.storage.copy_to_memory(submission)
        prompt_text = clean(prompt, MAX_TEXT)
        rubric_text = clean(rubric_csv, 800)

        def leader_fn():
            evidence_text = "No evidence URL was provided."
            if submission_memory.evidence_url != "":
                try:
                    response = gl.nondet.web.get(submission_memory.evidence_url)
                    evidence_text = response.body.decode("utf-8", errors="replace")[:3600]
                except Exception:
                    evidence_text = "Evidence fetch failed. Judge the answer conservatively using the prompt and selected source URL only."

            scoring_prompt = f"""You are the Truth Raiders GenLayer referee.

Room: {room_memory.room_code}
Season: {room_memory.season_code}
Chamber: {submission_memory.chamber}
Round prompt: {prompt_text}
Rubric: {rubric_text}

Player answer:
{submission_memory.answer}

Evidence URL:
{submission_memory.evidence_url}

Evidence text:
{evidence_text}

Grade the answer on a 0-100 scale.
High-quality correct answers should usually score 75-100.
Partially correct or weakly evidenced answers should score 40-74.
Wrong, hallucinated, unrelated, private, or low-effort answers should score 0-39.
Set accepted to true only when the score is at least 55.
Set xp_award equal to score when accepted is true, otherwise 0.

Respond with JSON only:
{{
  "score": 0,
  "accepted": false,
  "reason": "Concise judging reason.",
  "xp_award": 0
}}"""
            try:
                raw_response = gl.nondet.exec_prompt(scoring_prompt, response_format="json")
                return normalize_score(raw_response)
            except (AttributeError, TypeError, ValueError, KeyError, json.JSONDecodeError):
                return {
                    "score": 0,
                    "accepted": False,
                    "reason": "The referee could not parse a safe scoring result.",
                    "xp_award": 0,
                }

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                leader_data = normalize_score(leader_result.calldata)
            except (AttributeError, TypeError, ValueError, KeyError, json.JSONDecodeError):
                return False

            if not valid_score_payload(leader_data):
                return False

            evidence_text = "No evidence URL was provided."
            if submission_memory.evidence_url != "":
                try:
                    response = gl.nondet.web.get(submission_memory.evidence_url)
                    evidence_text = response.body.decode("utf-8", errors="replace")[:3600]
                except Exception:
                    evidence_text = "Evidence fetch failed. Judge the answer conservatively using the prompt and selected source URL only."

            validator_prompt = f"""You are validating a Truth Raiders game verdict.

Do not rescore from scratch. Decide if the leader verdict is acceptable for this prompt, answer, rubric, and evidence.

Round prompt:
{prompt_text}

Rubric:
{rubric_text}

Player answer:
{submission_memory.answer}

Evidence URL:
{submission_memory.evidence_url}

Evidence text:
{evidence_text}

Leader verdict:
{json.dumps(leader_data)}

Return JSON only:
{{
  "valid": true,
  "reason": "Short reason."
}}"""
            try:
                raw_response = gl.nondet.exec_prompt(validator_prompt, response_format="json")
                parsed = parse_json(raw_response)
                return normalize_bool(parsed.get("valid", False))
            except (AttributeError, TypeError, ValueError, KeyError, json.JSONDecodeError):
                return True

        try:
            verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        except (AttributeError, TypeError, ValueError, KeyError, json.JSONDecodeError):
            raise gl.vm.UserError(f"{ERROR_EXTERNAL} GenLayer scoring failed")

        score = clamp_score(verdict["score"])
        xp_award = clamp_score(verdict["xp_award"])
        accepted = bool(verdict["accepted"])

        if not accepted:
            xp_award = 0

        submission.score = u8(score)
        submission.xp_award = u256(xp_award)
        submission.accepted = accepted
        submission.reason = clean(str(verdict["reason"]), 240)
        submission.scored_at = gl.message_raw["datetime"]
        submissions[submission_index] = submission
        self.room_submissions[key] = submissions

        players = self._get_room_players(key)
        player_index = self._find_player_index(players, player)
        if player_index < 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Player has not joined")
        player_record = players[player_index]
        player_record.xp = u256(int(player_record.xp) + xp_award)
        players[player_index] = player_record
        self.room_players[key] = players
        self._append_audit(gl.message.sender_address, "ROUND_SCORED", key, submission.reason)

    @gl.public.write
    def finalize_room(self, room_id: int):
        key = self._room_key(room_id)
        room = self.rooms[key]
        if room.status == "finalized":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Room already finalized")
        room.status = "finalized"
        room.finalized_at = gl.message_raw["datetime"]
        self.rooms[key] = room
        self._append_audit(gl.message.sender_address, "ROOM_FINALIZED", key, room.room_code)

    @gl.public.view
    def get_room(self, room_id: int) -> dict:
        key = self._room_key(room_id)
        room = self.rooms[key]
        return {
            "id": int(room.id),
            "season_code": room.season_code,
            "room_code": room.room_code,
            "host": format(room.host),
            "status": room.status,
            "player_count": int(room.player_count),
            "round_count": int(room.round_count),
            "xp_pool": int(room.xp_pool),
            "created_at": room.created_at,
            "finalized_at": room.finalized_at,
        }

    @gl.public.view
    def get_leaderboard(self, room_id: int) -> list:
        key = self._room_key(room_id)
        result = []
        players = self._get_room_players(key)
        for index in range(len(players)):
            player = players[index]
            result.append(
                {
                    "wallet": format(player.wallet),
                    "handle": player.handle,
                    "avatar": player.avatar,
                    "xp": int(player.xp),
                    "joined_at": player.joined_at,
                }
            )
        result.sort(key=lambda item: item["xp"], reverse=True)
        return result[:MAX_LEADERBOARD]

    @gl.public.view
    def get_submission(self, room_id: int, round_id: int, player: Address) -> dict:
        key = self._room_key(room_id)
        submissions = self._get_room_submissions(key)
        submission_index = self._find_submission_index(submissions, round_id, player)
        if submission_index < 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Submission does not exist")
        submission = submissions[submission_index]
        return {
            "room_id": int(submission.room_id),
            "round_id": int(submission.round_id),
            "player": format(submission.player),
            "chamber": submission.chamber,
            "answer": submission.answer,
            "evidence_url": submission.evidence_url,
            "score": int(submission.score),
            "xp_award": int(submission.xp_award),
            "accepted": submission.accepted,
            "reason": submission.reason,
            "submitted_at": submission.submitted_at,
            "scored_at": submission.scored_at,
        }

    @gl.public.view
    def get_audit_log(self) -> list:
        result = []
        for event in self.audit_log:
            result.append(
                {
                    "timestamp": event.timestamp,
                    "actor": format(event.actor),
                    "action": event.action,
                    "target_id": int(event.target_id),
                    "details": event.details,
                }
            )
        return result

    @gl.public.view
    def get_room_count(self) -> int:
        return int(self.next_room_id)
