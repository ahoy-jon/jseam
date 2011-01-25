/**
* Seam carving -- refactored from
* http://labs.pimsworld.org/wp-content/uploads/2009/04/demo-content-aware-image-resizing-2/
*/
var SeamCarving = function(orgImgData, tmp, out){
	
	this.original = orgImgData;
	//R = luminance map, G = energy map, B = energy map, A = seam map
	this.tmp = tmp;
	//resized image
	this.out = out;
	
	this._currentWidth = this.original.width;
	this._currentHeight = this.original.height;
	this._currentdata = this.original.data; // current resize step RGBA
	this._tmp = [];			// current step gray + energy + sobel + seam
	
};

SeamCarving.prototype = {
	_process: function(){
		var tmp = this._tmp;
		var l = this._currentdata.length;
		
		//init tmp (black, full opacity)
		for(pixel = 0; pixel < l; pixel += 4){
			tmp[pixel] = tmp[pixel + 1] = tmp[pixel + 2] = 0;
			tmp[pixel + 3] = 255;
		}
		
		this._desaturate();
		this._sobelAndEnergy();
		this._seamMap();
		this._sliceSeam();
	},
	
	/**
	* Create grayscale image
	*/
	_desaturate: function(){
		var pixel;
		var outImgData = this._tmp;
		var srcImgData = this._currentdata;
	
		for (pixel = 0; pixel < srcImgData.length; pixel += 4)
			outImgData[pixel] = (299 * srcImgData[pixel] + 587 * srcImgData[pixel + 1] + 114 * srcImgData[pixel + 2])/1000;
	},
	
	/**
	* build sobel and energy map
	*/
	_sobelAndEnergy: function(){
		var width = this._currentWidth, 
		height = this.__currentHeight,
		data = this._tmp,
     
		sobelPixelH, sobelPixelV, sobelResult,
		topLeft, topMiddle, topRight, bottomLeft, bottomMiddle, bottomRight, leftMiddle, rightMiddle,
		
		pixel,
		minEnergy,
		
		p;
		
		for (pixel = 0; pixel < data.length; pixel += 4) {
				
			topLeft =      pixel - (width + 1) * 4;
			topMiddle =    pixel - (width    ) * 4;
			topRight =     pixel - (width - 1) * 4;
			
			bottomLeft =   pixel + (width - 1) * 4;
			bottomMiddle = pixel + (width    ) * 4;
			bottomRight =  pixel + (width + 1) * 4;
			
			leftMiddle =   pixel - 4;
			rightMiddle =  pixel + 4;

			/* Vertical Sobel */
			sobelPixelV =
				+ 1 * (data[topLeft]     || 0)
				+ 2 * (data[topMiddle]   || 0)  
				+ 1 * (data[topRight]    || 0) 
				- 1 * (data[bottomLeft]  || 0) 
				- 2 * (data[bottomMiddle]|| 0) 
				- 1 * (data[bottomRight] || 0);
			
			/* Horizontal Sobel */
			sobelPixelH =
				+ 1 * (data[topLeft]     || 0)
				+ 2 * (data[leftMiddle]  || 0)  
				+ 1 * (data[bottomLeft]  || 0) 
				- 1 * (data[topRight]    || 0) 
				- 2 * (data[rightMiddle] || 0) 
				- 1 * (data[bottomRight] || 0);
			sobelResult = 
				Math.sqrt((sobelPixelV* sobelPixelV)+(sobelPixelH * sobelPixelH))/80;
			
			minEnergy = Math.min(Math.min(data[topLeft+1],data[topMiddle+1]),data[topRight+1]);
			minEnergy = isNaN(minEnergy) ? sobelResult : minEnergy + sobelResult;
			
			/* Should be done by the canvas implementation at the browser level
			 http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#dom-canvaspixelarray-set
			 if (minEnergy > 255) minEnergy = 255;
			if (minEnergy < 0) minEnergy = 0;*/
			
			data[pixel + 1] = Math.round(minEnergy);
			data[pixel + 2] = sobelResult * 20; //random coef
		}
	},
		
	// Copy intermediate image to dest
	// 0 = grayscale,
	// 1 = energy,
	// 2 = Sobel,
	// 3 = seam
	debug: function(dest, mod){
		var tmp = this._tmp;
		var ddata = dest.data;
		for(pixel = 0; pixel < tmp.length; pixel += 4){
			ddata[pixel] = ddata[pixel + 1] = ddata[pixel + 2] = tmp[pixel + mod];
			ddata[pixel + 3] = tmp[pixel + 3];
		}
		return dest;
	},
	
	_seamMap:function(){
		var minEnergyPosition,
		tmpEnergy = Number.MAX_VALUE,
		currentWidth = this._currentWidth,
		currentHeight = this._currentHeight,
		pseudoImgData = this._tmp,
		topLeftPosition, topMiddlePosition, topRightPosition,topLeftValue, topMiddleValue, topRightValue,
		minEnergyValue,

		pixel,
		x, y;

		//search on last row
		for (x = 0; x < currentWidth ; x++) {
			pixel = ( (currentHeight - 1) * currentWidth + x    ) * 4;
			if (pseudoImgData[pixel+1] < tmpEnergy){
				minEnergyPosition = pixel;
				tmpEnergy = pseudoImgData[pixel+1];
			}
		}
		
		pseudoImgData[minEnergyPosition + 3] = 0;

		lastMinEnergyPosition = minEnergyPosition - 4;

		for (y = currentHeight - 1; y > 0 ; y--) {
			topLeftPosition =      minEnergyPosition - currentWidth * 4 - 4;
			topMiddlePosition =    minEnergyPosition - currentWidth * 4;
			topRightPosition =     minEnergyPosition - currentWidth * 4 + 4;

			topLeftValue =      pseudoImgData[topLeftPosition   + 1];
			topMiddleValue =    pseudoImgData[topMiddlePosition + 1];
			topRightValue =     pseudoImgData[topRightPosition  + 1];

			minEnergyValue = topMiddleValue;
			minEnergyPosition = topMiddlePosition;

			//Low energy + detect the image left and right borders
			if (topLeftValue < minEnergyValue && ((topMiddlePosition % (currentWidth)) > 0)){
				minEnergyValue = topMiddleValue;
				minEnergyPosition = topLeftPosition;
			}
			if (topRightValue < minEnergyValue && (((topMiddlePosition + 4) % (currentWidth)) > 0)){
				minEnergyValue = topRightValue;
				minEnergyPosition = topRightPosition;
			}
			
			pseudoImgData[minEnergyPosition + 3] = 0;
		}
	},
	
	_sliceSeam: function(){
		//-2 and -1 must be set according to the factor
		var srcImgDataData = this._currentdata,
		srcSeamMapData = this._tmp,
		resultImageData = [],
		oldIndex = 0, 
		newIndex = 0;
		var numberFound = 0;
		/*
		while(oldIndex < srcImgDataData.length){
			if (srcSeamMapData[oldIndex + 3]  > 0) {
				resultImageData[newIndex] =    srcImgDataData[oldIndex];
				resultImageData[newIndex+1] =  srcImgDataData[oldIndex+1];
				resultImageData[newIndex+2] =  srcImgDataData[oldIndex+2];
				resultImageData[newIndex+3] =  srcImgDataData[oldIndex+3];
				newIndex += 4;
			}
			oldIndex += 4;
		}
		*/
		
		for(i = 0; i < srcImgDataData.length; i+=4)
			if(srcSeamMapData[i + 3]  > 0)
				for(j = 0; j < 4; j++)
					resultImageData.push(srcImgDataData[i + j])
		
		this._currentWidth--;
		this._currentdata = resultImageData;
	},
	
	resize: function(){
		
		while(this._currentdata.length > this.out.data.length){
			this._process();
		}
			
		for(i = 0; i < this.out.data.length; i++){
			this.out.data[i] = this._currentdata[i];
		}
	}
}
