// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Tank Blitz — virtual points on-chain; real MON is only the entry prize pool.
contract TankBlitz {
    address public immutable server;
    address public owner;

    uint256 public constant ENTRY_FEE = 0.1 ether;
    uint256 public constant STARTING_POINTS = 100;
    uint16 public constant STARTING_HP = 100;
    uint16 public constant STARTING_AMMO = 20;
    /// @dev Stored as 100 for 10.0 (one decimal place of precision).
    uint16 public constant ATTACK_POWER = 100;
    uint256 public constant AMMO_POINT_COST = 10;
    uint256 public constant SHOT_PROTOCOL_POINTS = 1;
    uint8 public constant MAX_PLAYERS = 5;
    uint8 public constant MIN_PLAYERS = 2;

    bool private _entered;

    enum GameStatus {
        Waiting,
        Active,
        Ended
    }

    struct Player {
        uint256 points;
        uint16 hp;
        uint16 ammo;
        uint16 attackPower;
        bool joined;
    }

    struct Game {
        bool initialized;
        GameStatus status;
        address[] playerList;
        mapping(address => Player) players;
        uint256 prizePool;
        uint256 protocolPoints;
    }

    mapping(uint256 => Game) private games;
    uint256 public nextGameId;

    modifier onlyServer() {
        require(msg.sender == server, "Not server");
        _;
    }

    modifier nonReentrant() {
        require(!_entered, "Reentrant");
        _entered = true;
        _;
        _entered = false;
    }

    event GameCreated(uint256 indexed gameId);
    event PlayerJoined(uint256 indexed gameId, address indexed player);
    event GameStarted(uint256 indexed gameId);
    event KillRecorded(
        uint256 indexed gameId,
        address indexed killer,
        address indexed victim,
        uint256 pointsTransferred
    );
    event AmmoPurchase(uint256 indexed gameId, address indexed player);
    event ShotFired(uint256 indexed gameId, address indexed shooter);
    event GameEnded(
        uint256 indexed gameId,
        address indexed winner,
        uint256 ownerPayout,
        uint256 winnerPayout
    );

    constructor(address _server) {
        require(_server != address(0), "Server");
        server = _server;
        owner = msg.sender;
    }

    /// @notice Backend creates a lobby before players can register.
    function createGame() external onlyServer returns (uint256 gameId) {
        gameId = ++nextGameId;
        Game storage g = games[gameId];
        g.initialized = true;
        g.status = GameStatus.Waiting;
        emit GameCreated(gameId);
    }

    /// @notice Player pays the native token entry fee; receives starting virtual stats.
    function registerPlayer(uint256 gameId) external payable {
        require(msg.value == ENTRY_FEE, "Entry fee");
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Waiting, "Not lobby");
        require(g.playerList.length < MAX_PLAYERS, "Full");
        require(!g.players[msg.sender].joined, "Already joined");

        g.players[msg.sender] = Player({
            points: STARTING_POINTS,
            hp: STARTING_HP,
            ammo: STARTING_AMMO,
            attackPower: ATTACK_POWER,
            joined: true
        });
        g.playerList.push(msg.sender);
        g.prizePool += msg.value;

        emit PlayerJoined(gameId, msg.sender);
    }

    function startGame(uint256 gameId) external onlyServer {
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Waiting, "Bad status");
        uint256 n = g.playerList.length;
        require(n >= MIN_PLAYERS && n <= MAX_PLAYERS, "Player count");
        g.status = GameStatus.Active;
        emit GameStarted(gameId);
    }

    function recordKill(
        uint256 gameId,
        address killer,
        address victim
    ) external onlyServer {
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Active, "Not active");
        require(g.players[killer].joined && g.players[victim].joined, "Not players");
        require(killer != victim, "Self");

        uint256 victimPoints = g.players[victim].points;
        g.players[killer].points += victimPoints;
        g.players[victim].points = 0;
        g.players[victim].hp = 0;

        emit KillRecorded(gameId, killer, victim, victimPoints);
    }

    function buyAmmo(uint256 gameId, address player) external onlyServer {
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Active, "Not active");
        require(g.players[player].joined, "Not player");
        require(g.players[player].points >= AMMO_POINT_COST, "Points");

        g.players[player].points -= AMMO_POINT_COST;
        g.players[player].ammo += 10;

        emit AmmoPurchase(gameId, player);
    }

    function recordShot(uint256 gameId, address shooter) external onlyServer {
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Active, "Not active");
        require(g.players[shooter].joined, "Not player");
        require(g.players[shooter].ammo > 0, "No ammo");
        require(g.players[shooter].points >= SHOT_PROTOCOL_POINTS, "Points");

        g.players[shooter].ammo -= 1;
        g.players[shooter].points -= SHOT_PROTOCOL_POINTS;
        g.protocolPoints += SHOT_PROTOCOL_POINTS;

        emit ShotFired(gameId, shooter);
    }

    /// @notice Splits the real MON prize pool from server-authoritative winner points (virtual economy).
    /// @dev totalExpected = STARTING_POINTS * playerCount. Consumed points are implied by totalExpected - winnerPoints.
    ///      Owner share = pool * consumed / totalExpected; winner gets the remainder.
    function endGame(
        uint256 gameId,
        address winner,
        uint256 winnerPoints
    ) external onlyServer nonReentrant {
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Active, "Not active");
        require(g.players[winner].joined, "Not player");

        uint256 playerCount = g.playerList.length;
        uint256 totalExpected = STARTING_POINTS * playerCount;
        require(totalExpected > 0, "Total points");
        require(winnerPoints <= totalExpected, "Winner points");

        uint256 pool = g.prizePool;
        require(address(this).balance >= pool, "Balance");

        uint256 consumed = totalExpected - winnerPoints;
        uint256 ownerShare = (pool * consumed) / totalExpected;
        uint256 winnerShare = pool - ownerShare;

        g.prizePool = 0;
        g.protocolPoints = 0;
        g.players[winner].points = 0;
        g.status = GameStatus.Ended;

        (bool okOwner, ) = payable(owner).call{value: ownerShare}("");
        require(okOwner, "Owner pay");
        (bool okWinner, ) = payable(winner).call{value: winnerShare}("");
        require(okWinner, "Winner pay");

        emit GameEnded(gameId, winner, ownerShare, winnerShare);
    }

    function getGameInfo(uint256 gameId)
        external
        view
        returns (
            uint8 status,
            uint256 playerCount,
            uint256 prizePool,
            uint256 protocolPoints
        )
    {
        Game storage g = games[gameId];
        if (!g.initialized) {
            return (0, 0, 0, 0);
        }
        return (
            uint8(g.status),
            g.playerList.length,
            g.prizePool,
            g.protocolPoints
        );
    }

    function getPlayer(uint256 gameId, address player)
        external
        view
        returns (
            uint256 points,
            uint16 hp,
            uint16 ammo,
            uint16 attackPower,
            bool joined
        )
    {
        Player storage p = games[gameId].players[player];
        return (p.points, p.hp, p.ammo, p.attackPower, p.joined);
    }

    function getPlayerList(uint256 gameId) external view returns (address[] memory) {
        Game storage g = games[gameId];
        if (!g.initialized) {
            return new address[](0);
        }
        return g.playerList;
    }

    receive() external payable {
        revert("No direct send");
    }
}
