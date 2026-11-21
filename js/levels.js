// 5 Levels with progressive difficulty (Canvas coordinate system: 540 x 760)
window.GAME_LEVELS = [
  {
    id: 1,
    name: "Первая чекушка",
    hint: "Свайпни мышкой по верёвке, чтобы уронить чекушок прямо к Меллстрою!",
    bottle: { x: 270, y: 200 },
    character: { x: 270, y: 650 },
    ropes: [
      { x: 270, y: 92, length: 108, segments: 7 }
    ],
    stars: [
      { x: 270, y: 300 },
      { x: 270, y: 405 },
      { x: 270, y: 510 }
    ],
    cushions: [],
    bumpers: []
  },
  {
    id: 2,
    name: "Маятник удачи",
    hint: "Сначала перережь правую верёвку для раскачки, затем левую!",
    bottle: { x: 375, y: 215 },
    character: { x: 255, y: 650 },
    ropes: [
      { x: 245, y: 96, length: 175, segments: 9 },
      { x: 398, y: 96, length: 122, segments: 7 }
    ],
    stars: [
      { x: 315, y: 262 },
      { x: 235, y: 272 },
      { x: 255, y: 455 }
    ],
    cushions: [],
    bumpers: []
  },
  {
    id: 3,
    name: "Подушка-дулка",
    hint: "Нажми на синюю подушку-дулку, чтобы сдуть чекушок к звёздам!",
    bottle: { x: 245, y: 255 },
    character: { x: 315, y: 650 },
    ropes: [
      { x: 245, y: 94, length: 161, segments: 9 }
    ],
    stars: [
      { x: 295, y: 252 },
      { x: 368, y: 215 },
      { x: 315, y: 455 }
    ],
    cushions: [
      { x: 96, y: 255, angle: 0, range: 290, power: 0.024 }
    ],
    bumpers: []
  },
  {
    id: 4,
    name: "Двойной поддув",
    hint: "Используй подушки-дулки по бокам и вовремя перерезай верёвки!",
    bottle: { x: 270, y: 210 },
    character: { x: 270, y: 650 },
    ropes: [
      { x: 185, y: 94, length: 145, segments: 8 },
      { x: 355, y: 94, length: 145, segments: 8 }
    ],
    stars: [
      { x: 195, y: 245 },
      { x: 345, y: 245 },
      { x: 270, y: 455 }
    ],
    cushions: [
      { x: 82, y: 250, angle: 0, range: 300, power: 0.024 },
      { x: 458, y: 250, angle: Math.PI, range: 300, power: 0.024 }
    ],
    bumpers: []
  },
  {
    id: 5,
    name: "Вираж Босса",
    hint: "Перережь левую верёвку, поддуй подушками и отправь чекушок в цель!",
    bottle: { x: 175, y: 190 },
    character: { x: 290, y: 650 },
    ropes: [
      { x: 135, y: 92, length: 106, segments: 6 },
      { x: 265, y: 92, length: 135, segments: 8 },
      { x: 375, y: 115, length: 210, segments: 10 }
    ],
    stars: [
      { x: 248, y: 228 },
      { x: 342, y: 288 },
      { x: 290, y: 470 }
    ],
    cushions: [
      { x: 78, y: 225, angle: -0.08, range: 310, power: 0.025 },
      { x: 462, y: 335, angle: Math.PI * 0.94, range: 310, power: 0.024 }
    ],
    bumpers: [
      { x: 170, y: 430, radius: 32 }
    ]
  }
];
