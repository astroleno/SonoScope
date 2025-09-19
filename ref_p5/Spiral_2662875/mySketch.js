/*
It is a 3D shader made for the weekly Creative Coding Challenge
(https://openprocessing.org/curation/78544) on the theme "Spiral".

Experimenting with this kind of shader programming with some 
nice results:

Here is a boxed version:
https://codepen.io/atzedent/full/azObdyy

And this is it poking around in the wildernis:
https://codepen.io/atzedent/full/oggKrGW

Finally, here's one I caught in a dark forest:
https://www.shadertoy.com/view/tfV3W3
*/

let theShader, moves=[0,0], dpr = Math.max(1, 0.75 * window.devicePixelRatio), ww = window.innerWidth*dpr, wh = window.innerHeight*dpr, startRandom;
const canvasStyle = 'width:100%;height:auto;touch-action:none;object-fit:contain;'

function mouseMove() {
	if (!mouseIsPressed) return;
	moves[0] += mouseX - pmouseX;
	moves[1] += pmouseY - mouseY;
}

function windowResized() {
	ww = window.innerWidth*dpr; wh = window.innerHeight*dpr;
  resizeCanvas(ww, wh);
	canvas.style = canvasStyle;
}

function preload(){
	theShader = loadShader('vert.glsl', 'frag.glsl');
}

function setup() {
  pixelDensity(1);
  createCanvas(ww, wh, WEBGL);
	canvas.style = canvasStyle;
	startRandom = Math.random();
}

function draw() {
  shader(theShader);
	mouseMove();
  theShader.setUniform("resolution", [width, height]);
  theShader.setUniform("time", millis() / 1000.0);
	theShader.setUniform("move", moves);
  theShader.setUniform("pointerCount", mouseIsPressed ? 1 : 0);
	theShader.setUniform("startRandom", startRandom); // each time the shader starts, make it unique
  rect(0,0,width,height);
}

// Override to enable webgl2 and support for high resolution and retina displays
p5.RendererGL.prototype._initContext = function() {
	try { this.drawingContext = this.canvas.getContext('webgl2', this._pInst._glAttributes) ||
			this.canvas.getContext('experimental-webgl', this._pInst._glAttributes);
		if (this.drawingContext === null) { throw new Error('Error creating webgl context');
		} else { const gl = this.drawingContext; 
			gl.viewport(0, 0, ww, wh);
			this._viewport = this.drawingContext.getParameter(this.drawingContext.VIEWPORT);
		} } catch (er) { throw er; }
};