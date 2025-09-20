let colors = [];
let colorbg;
let grid;
let cellSize = 20;
let cols, rows;
let maxAge = 80;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB);
  // frameRate(10);

  let scheme = random(colorScheme);
  colors = scheme.colors;
  colorbg = random(bgcolor);

  background(colorbg);

  cols = floor(width / cellSize);
  rows = floor(height / cellSize);
  grid = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => ({
      alive: random() < 0.02,
      age: 0,
      shape: random(["circle", "triangle", "rect"]),
    }))
  );
}

function draw() {
  background(colorbg + "0F"); // 残影感

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let cell = grid[i][j];
      if (cell.alive) {
				
        cell.age++;

        let x = i * cellSize + cellSize / 2;
        let y = j * cellSize + cellSize / 2;
        let size = map(cell.age, 0, maxAge, 1, cellSize);

        let c = lerpColor(
          color(colors[0]),
          color(colors[colors.length - 1]),
          constrain(cell.age / maxAge, 0, 1)
        );
        c.setAlpha(180);
        // fill(c);
				fill(getFlowingColor(i, j, cell.age));
        noStroke();

        push();
        translate(x, y);
        drawShape(cell.shape, size);
        pop();

        if (cell.age > maxAge) cell.alive = false;
      }
    }
  }

  updateGrowth();
}

function drawShape(type, size) {
  switch (type) {
    case "circle":
      ellipse(0, 0, size, size);
      break;
    case "triangle":
      let h = size * sqrt(3) / 2;
      triangle(
        0, -h / 2,
        -size / 2, h / 2,
        size / 2, h / 2
      );
      break;
    case "rect":
      rectMode(CENTER);
      rect(0, 0, size, size);
      break;
  }
}

function updateGrowth() {
  let next = [];

  for (let i = 0; i < cols; i++) {
    next[i] = [];
    for (let j = 0; j < rows; j++) {
      let cell = grid[i][j];
      let neighbors = countAliveNeighbors(i, j);

      let newCell = { ...cell };
      if (!cell.alive && neighbors >= 2 && random() < 0.05) {
        newCell.alive = true;
        newCell.age = 0;
      }

      next[i][j] = newCell;
    }
  }

  grid = next;
}

function countAliveNeighbors(x, y) {
  let count = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      let nx = (x + dx + cols) % cols;
      let ny = (y + dy + rows) % rows;
      if (grid[nx][ny].alive) count++;
    }
  }
  return count;
}

function getFlowingColor(i, j, age) {
  let px = i / cols;
  let py = j / rows;
  let t = frameCount * 0.01;
  let n = sin(px * 2 + py * 2 + t) * 0.5 + 0.5;

  let ageFactor = constrain(age / maxAge, 0, 1);
  let blend = (ageFactor + n) / 2;

  let indexA = floor(blend * (colors.length - 1));
  let indexB = (indexA + 1) % colors.length;
  let mix = blend * (colors.length - 1) % 1;

  let c = lerpColor(color(colors[indexA]), color(colors[indexB]), mix);
  c.setAlpha(160);
  return c;
}
