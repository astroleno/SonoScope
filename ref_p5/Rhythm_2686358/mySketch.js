// by SamuelYAN
// more works //
// https://twitter.com/SamuelAnn0924
// https://www.instagram.com/samuel_yan_1990/

let seed;
let mySize, margin;
let num;
let myGraphic;
let palette, color_bg;
let str_wei;
let angle_c;
let branch;

let unit_x, unit_y;
let count;
let t;
let mods = [];
let a, b, c;

function setup() {
	a = TAU / TAU;
	b = a + a;
	c = a - a;
	seed = Math.random() * sq(sq(sq(int(TAU))));
	randomSeed(seed);

	mySize = min(windowWidth, windowHeight) * 0.9;
	createCanvas(windowWidth, windowHeight, WEBGL);

	perspective(0.5, width / height, 5, 20000);
	palette = random(colorScheme).colors.concat();
	color_bg = random(bgcolor);
	background(color_bg);
	frameRate(50);
	t = rez = c = n = c;
	angle_c = 0;
	branch = 30;
}

function draw() {
	randomSeed(seed);
	let scheme = random(colorScheme);
	colors = scheme.colors;
	background(random(bgcolor));

	translate(0, 0, -mySize * 3 - t * 10000);

	// rotateX(random([-1, 1]) * 0.1 / random(1, 2) * sin(frameCount / 10));
	// rotateY(random([-1, 1]) * 0.1 / random(1, 2) * sin(frameCount / 10));
	// rotateZ(random([-1, 1]) * 0.1 / random(1, 2) * sin(frameCount / 10));

	for (let i = 0; i < 3; i++) {

		circleForm(0, 0, mySize * 0.8 * (i + 1) / 2);
	}

	angle_c += TAU / 360 / 10;

	push();
	// rotateX(random(TAU));
	rotateX(PI / 2 + t * 10);
	rotateY(random(TAU));
	// rotateZ(random(TAU));
	// rotateX(random([-1, 1]) * frameCount / random(100, 200));
	rotateY(random([-1, 1]) * frameCount / random(100, 200));
	// rotateZ(random([-1, 1]) * frameCount / random(100, 200));

	// 🌟 花瓶形状参数
	let layers = int(random(4, 10)) * 8;
	let rings = 4 * int(random(4, 10));

	for (let yIdx = 0; yIdx < layers; yIdx++) {
		let yNorm = map(yIdx, 0, layers - 1, -1, 1);
		let radius = vaseProfile(yNorm);
		let y = yNorm * mySize * random(0.9, 1.5);

		for (let r = 0; r < rings; r++) {
			let angle = map(r, 0, rings, 0, TWO_PI);
			let x = radius * cos(angle);
			let z = radius * sin(angle);

			push();
			translate(x, y, z);
			// rotateX(angle + frameCount / 100);
			rotateY(yNorm * PI + frameCount / 120);

			stroke(random(colors));
			strokeWeight(2 * random(1, 2));
			point(0, 0, 0);

			pop();
		}
	}

	pop();

	t += 0.1 / random(10, 1) / random(3, 7) / 10;
	rez += 0.1 / random(10, 1) / random(3, 7) / 10;
}

function circleForm(x, y, d) {
	let ang = TAU / branch;
	let angles = [];
	for (let i = 0; i < branch; i++) {
		angles.push(ang * (i + iteration(0.1, 0.25)));
	}
	push();
	rotateX(PI / 2 + t * 10);
	rotateZ(PI / 2)
	for (let i = 0; i < branch; i++) {
		let ang1 = angles[i];
		let ang2 = angles[(i + int(random(1, 100))) % angles.length];
		let dd = d * iteration(0.1, 1);

		noFill();
		stroke(random(colors));
		strokeWeight(random(10));
		beginShape();
		for (let j = ang1; j < ang2; j += 0.1) {
			let x1 = dd * cos(i);
			let y1 = dd * sin(j);
			let z1 = dd * cos(j);

			// rotateX((angle_c));
			// rotateY(angle_c + frameCount / 50000);
			// rotateX(ang1);
			// rotateY(ang2);
			// rotateZ(angle_c);
			vertex(x1, y1, z1);
		}
		endShape();
	}
	pop();

}

function iteration(s, e) {
	let t = random(10, 100);
	let v = random(0.001, 0.01);
	return map(cos(t + frameCount * v), -1, 1, s, e);
}

function vaseProfile(yNorm) {
	// yNorm: from -1 (bottom) to 1 (top)
	// 模拟古代器皿鼓腹、束颈、收底等形状
	return (
		mySize * random(0.5, 0.9) * sin(PI * (yNorm + 10) / 2) + // 主体鼓起
		mySize * random(0.1, 0.25) * cos(3 * PI * yNorm) + // 微细节变化
		mySize * random(0, 0.8) // 基础厚度
	);
}

function heart(x, y, size) {
	beginShape();
	vertex(x, y);
	bezierVertex(x - size / 2, y - size / 2, x - size, y + size / 3, x, y + size);
	bezierVertex(x + size, y + size / 3, x + size / 2, y - size / 2, x, y);
	endShape(CLOSE);
}