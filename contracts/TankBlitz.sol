// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Tank Blitz — ammo is paid in MON; balances move on kills; prize pool splits on game end.
contract TankBlitz {
    address public immutable server;
    address public owner;

    uint16 public constant STARTING_HP = 100;
    /// @dev Stored as 100 for 10.0 (one decimal place of precision).
    uint16 public constant ATTACK_POWER = 100;
    uint8 public constant MAX_PLAYERS = 5;
    uint8 public constant MIN_PLAYERS = 2;

    uint16 public constant MIN_AMMO = 10;
    uint16 public constant MAX_AMMO = 50;
    uint256 public constant AMMO_PRICE = 0.01 ether;
    uint256 public constant PROTOCOL_FEE_BPS = 500;

    bool private _entered;

    enum GameStatus {
        Waiting,
        Active,
        Ended
    }

    struct Player {
        uint256 monBalance;
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
        uint256 monTransferred
    );
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

    /// @notice Player pays MON for ammo; stake becomes in-game MON balance.
    function registerPlayer(uint256 gameId, uint256 ammoCount) external payable {
        require(ammoCount >= uint256(MIN_AMMO) && ammoCount <= uint256(MAX_AMMO), "Ammo");
        require(msg.value == ammoCount * AMMO_PRICE, "Payment");
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Waiting, "Not lobby");
        require(g.playerList.length < MAX_PLAYERS, "Full");
        require(!g.players[msg.sender].joined, "Already joined");

        g.players[msg.sender] = Player({
            monBalance: msg.value,
            hp: STARTING_HP,
            ammo: uint16(ammoCount),
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

        uint256 victimMon = g.players[victim].monBalance;
        g.players[killer].monBalance += victimMon;
        g.players[victim].monBalance = 0;
        g.players[victim].hp = 0;

        emit KillRecorded(gameId, killer, victim, victimMon);
    }

    /// @notice 5% protocol fee, 95% to winner (of total prize pool).
    function endGame(uint256 gameId, address winner) external onlyServer nonReentrant {
        Game storage g = games[gameId];
        require(g.initialized, "No game");
        require(g.status == GameStatus.Active, "Not active");
        require(g.players[winner].joined, "Not player");

        uint256 pool = g.prizePool;
        require(address(this).balance >= pool, "Balance");
        require(pool > 0, "Pool");

        uint256 protocolFee = (pool * PROTOCOL_FEE_BPS) / 10_000;
        uint256 winnerShare = pool - protocolFee;

        g.prizePool = 0;
        g.players[winner].monBalance = 0;
        g.status = GameStatus.Ended;

        (bool okOwner, ) = payable(owner).call{value: protocolFee}("");
        require(okOwner, "Owner pay");
        (bool okWinner, ) = payable(winner).call{value: winnerShare}("");
        require(okWinner, "Winner pay");

        emit GameEnded(gameId, winner, protocolFee, winnerShare);
    }

    function getGameInfo(uint256 gameId)
        external
        view
        returns (
            uint8 status,
            uint256 playerCount,
            uint256 prizePool
        )
    {
        Game storage g = games[gameId];
        if (!g.initialized) {
            return (0, 0, 0);
        }
        return (uint8(g.status), g.playerList.length, g.prizePool);
    }

    function getPlayer(uint256 gameId, address player)
        external
        view
        returns (
            uint256 monBalance,
            uint16 hp,
            uint16 ammo,
            uint16 attackPower,
            bool joined
        )
    {
        Player storage p = games[gameId].players[player];
        return (p.monBalance, p.hp, p.ammo, p.attackPower, p.joined);
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
