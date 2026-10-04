// Shared constants. Physics numbers are the same ones the original canvas build used.
export const W = 960, H = 540;

export const GRAV = 2400, RUN = 340, JUMP_V = -940, JET_THRUST = 5200, JET_SPEED = 460, MAX_FALL = 1500;
export const ACC_GROUND = 2600, ACC_AIR = 1500;
export const COYOTE = 0.1, JUMP_BUFFER = 0.12, ATK_BUFFER = 0.15;
export const PLAYER_W = 28, PLAYER_H = 100, PLAYER_DUCK_H = 50;
export const INVULN = 1.4, MAX_HP = 3;

// Frame rectangles auto-detected from the alpha channel of the sprite sheets
export const FRAMES = {
  idle:   [[299,76,164,210],[514,78,166,208],[735,78,162,207],[946,77,162,209]],
  run:    [[77,328,172,220],[293,331,177,217],[518,333,169,216],[735,330,176,217],[963,332,178,216],[1183,334,199,215]],
  jump:   [[77,660,185,165],[315,588,163,208],[544,594,159,198],[758,592,150,200],[989,589,157,205],[1214,590,161,209]],
};
export const SPR_SCALE = 0.5;   // sprite sheet px -> world px

// Enemy drone sheet (faces right): hover, dash, laser, death
export const DFR = {
  hover: [[55,44,317,212],[404,50,308,213],[747,49,316,216],[1109,50,314,209]],
  // dash boundaries re-measured: the auto-detected ones cut each drone's nose off into the next frame
  dash:  [[25,330,257,158],[282,330,242,158],[524,330,235,158],[759,330,234,158],[993,330,231,158],[1224,330,222,158]],
  shoot: [[29,567,303,192],[369,568,329,192],[725,569,361,198],[1086,569,348,190]],
  death: [[37,833,310,190],[383,832,313,191],[732,823,316,226],[1085,800,339,260]],
};
// shoot3's rectangle also catches the tail of shoot2's laser beam behind the drone; fade it out
// (frame-local sheet px: the beam fades from fully erased at x to untouched at x + w)
export const DFR_FADE = { shoot3: [0, 98, 100, 52] };
export const DASH_NOSE = 158;   // dash frames: body centre sits this many sheet px left of the nose (right edge)
export const DR_SCALE = 0.26, SHOOT_TIME = 0.7, SHOOT_FIRE = 0.38, LASER_SPEED = 560;

// Player energy-shot sheet (faces right): charge, fire, projectile
// charge/fire entries are [x, y, w, h, bodyX]: bodyX is the sheet x that sits 41 world px behind the feet.
// Rectangles were re-measured to include the faint glow; the old ones cut it off or caught the neighbour's.
export const SFR = {
  charge: [[29,23,127,169,95],[207,25,143,167,273],[383,27,196,167,449],[596,26,214,168,661],[823,25,197,170,866],[1039,26,195,170,1104],[1259,23,205,174,1325]],
  fire:   [[7,224,187,165,73],[200,230,211,165,256],[411,230,210,165,466],[621,233,358,163,676]],
  proj:   [[1014,276,183,90],[1237,289,140,67],[1405,301,85,49]],
};
export const SH_SCALE = 0.62, ATK_TIME = 0.42, ATK_FIRE = 0.28, SHOT_SPEED = 780;

export const CYAN = '#35e9ff', RED = '#ff2d55';
export const HUD_FONT = 'Rajdhani, "Segoe UI", system-ui, sans-serif';

// Render order
export const DEPTH = { bg: 0, fog: 1, shaft: 2, deco: 3, plat: 4, steam: 5, pickup: 6, enemy: 7, shot: 8, player: 9, fx: 10, pop: 11 };
