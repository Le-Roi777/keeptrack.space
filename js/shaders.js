(function () {
  var shaderLoader = {};

  shaderLoader.shaderData = [
    {
      'name': 'earth-fragment.glsl',
      'code': `
        precision mediump float;

        uniform vec3 uAmbientLightColor;
        uniform vec3 uDirectionalLightColor;
        uniform vec3 uLightDirection;

        varying vec2 texCoord;
        varying vec3 normal;

        uniform sampler2D uSampler;
        uniform sampler2D uNightSampler;

        void main(void) {
          float directionalLightAmount = max(dot(normal, uLightDirection), 0.0);
          vec3 lightColor = uAmbientLightColor + (uDirectionalLightColor * directionalLightAmount);
          vec3 litTexColor = texture2D(uSampler, texCoord).rgb * lightColor * 2.0;

          vec3 nightLightColor = texture2D(uNightSampler, texCoord).rgb * pow(1.0 - directionalLightAmount, 2.0) ;

          gl_FragColor = vec4(litTexColor + nightLightColor, 1.0);
        }`
    }, {
      'name': 'earth-vertex.glsl',
      'code': `
        attribute vec3 aVertexPosition;

        attribute vec2 aTexCoord;
        attribute vec3 aVertexNormal;
        uniform mat4 uPMatrix;
        uniform mat4 uCamMatrix;
        uniform mat4 uMvMatrix;
        uniform mat3 uNormalMatrix;

        varying vec2 texCoord;
        varying vec3 normal;
        varying float directionalLightAmount;

        void main(void) {
          gl_Position = uPMatrix * uCamMatrix * uMvMatrix * vec4(aVertexPosition, 1.0);
          texCoord = aTexCoord;

          normal = uNormalMatrix * aVertexNormal;
        }
      `
    }, {
      'name': 'sun-fragment.glsl',
      'code': '' +
        'precision mediump float;\n\n' +
        'uniform vec3 uAmbientLightColor;\n' +
        'varying vec2 texCoord;\n' +
        'varying vec3 normal;\n\n' +
        'uniform sampler2D uSampler;\n\n\n\n' +
        'void main(void) {\n' +
        '  vec3 lightColor = uAmbientLightColor;\n\n' +
        '  vec3 litTexColor = texture2D(uSampler, texCoord).rgb * lightColor;\n\n' +
        '  gl_FragColor = vec4(litTexColor, 1.0);\n' +
        '}'
    }, {
      'name': 'sun-vertex.glsl',
      'code': '' +
        'attribute vec3 aVertexPosition;\n\n' +
        'attribute vec2 aTexCoord;\n' +
        'attribute vec3 aVertexNormal;\n\n' +
        'uniform mat4 uPMatrix;\n' +
        'uniform mat4 uCamMatrix;\n' +
        'uniform mat4 uMvMatrix;\n' +
        'uniform mat3 uNormalMatrix;\n\n\n' +
        'varying vec2 texCoord;\n' +
        'varying vec3 normal;\n' +
        'varying float directionalLightAmount;\n\n' +
        'void main(void) {\n' +
        '  gl_Position = uPMatrix * uCamMatrix * uMvMatrix * vec4(aVertexPosition, 1.0);\n' +
        '  texCoord = aTexCoord;\n\n' +
        '  normal = uNormalMatrix * aVertexNormal;\n' +
        '}'
    }, {
      'name': 'moon-fragment.glsl',
      'code': `
        precision mediump float;

        uniform vec3 uAmbientLightColor;
        varying vec2 texCoord;
        varying vec3 normal;

        uniform sampler2D uSampler;

        void main(void) {
          vec3 lightColor = uAmbientLightColor;
          vec3 litTexColor = texture2D(uSampler, texCoord).rgb * lightColor;
          gl_FragColor = vec4(litTexColor, 1.0);
        }`
    }, {
      'name': 'moon-vertex.glsl',
      'code': `
        attribute vec3 aVertexPosition;

        attribute vec2 aTexCoord;
        attribute vec3 aVertexNormal;

        uniform mat4 uPMatrix;
        uniform mat4 uCamMatrix;
        uniform mat4 uMvMatrix;
        uniform mat3 uNormalMatrix;

        varying vec2 texCoord;
        varying vec3 normal;
        void main(void) {
          gl_Position = uPMatrix * uCamMatrix * uMvMatrix * vec4(aVertexPosition, 1.0);
          texCoord = aTexCoord;

          normal = uNormalMatrix * aVertexNormal;
        }`
    }, {
      'name': 'atmosphere-fragment.glsl',
      'code': 'precision mediump float;\n\nuniform vec3 uAmbientLightColor;\nuniform vec3 uDirectionalLightColor;\nuniform vec3 uLightDirection;\n\nvarying vec2 texCoord;\nvarying vec3 normal;\n\nuniform sampler2D uSampler;\nuniform sampler2D uNightSampler;\n\n\n\nvoid main(void) {\n  float directionalLightAmount = max(dot(normal, uLightDirection), 0.5);\n  vec3 lightColor = uAmbientLightColor + (uDirectionalLightColor * directionalLightAmount);\n  \n  vec3 litTexColor = texture2D(uSampler, texCoord).rgb * lightColor * 2.0;\n  \n  vec3 nightLightColor = texture2D(uNightSampler, texCoord).rgb * pow(1.0 - directionalLightAmount, 2.0) ;\n\n  gl_FragColor = vec4( 1.0, 1.0 , 1.0, 1.0 ) * 0.7;\n}'
    }, {
      'name': 'atmosphere-vertex.glsl',
      'code': 'attribute vec3 aVertexPosition;\n\nattribute vec2 aTexCoord;\nattribute vec3 aVertexNormal;\n\nuniform mat4 uPMatrix;\nuniform mat4 uCamMatrix;\nuniform mat4 uMvMatrix;\nuniform mat3 uNormalMatrix;\n\n\nvarying vec2 texCoord;\nvarying vec3 normal;\nvarying float directionalLightAmount;\n\nvoid main(void) {\n  gl_Position = uPMatrix * uCamMatrix * uMvMatrix * vec4(aVertexPosition, 1.0);\n  texCoord = aTexCoord;\n  \n  normal = uNormalMatrix * aVertexNormal;\n}\n'
    }, {
      'name': 'dot-fragment.glsl',
      'code': `
      precision mediump float;

      varying vec4 vColor;

      void main(void) {
        vec2 ptCoord = gl_PointCoord * 2.0 - vec2(1.0, 1.0);
        float r = 0.43 - min(abs(length(ptCoord)), 1.0);
        float alpha = pow(2.0 * r + 0.1, 3.0);
        alpha = min(alpha, 1.0);
        gl_FragColor = vec4(vColor.rgb,1.0 * alpha);
      }
    `
    }, {
      'name': 'dot-vertex-var.glsl',
      'code': `
        attribute vec3 aPos;
        attribute vec4 aColor;
        attribute float aStar;

        uniform float minSize;
        uniform float maxSize;

        uniform mat4 uCamMatrix;
        uniform mat4 uMvMatrix;
        uniform mat4 uPMatrix;

        varying vec4 vColor;

        void main(void) {
          vec4 position = uPMatrix * uCamMatrix *  uMvMatrix * vec4(aPos, 1.0);

          gl_PointSize = min(max(pow(40000.0 \/ position.z, 2.1), minSize * aStar), maxSize) * 1.0;
          gl_Position = position;
          vColor = aColor;
        }
      `
    }, {
      'name': 'dot-vertex-3.glsl',
      'code': `
        attribute vec4 color;
        attribute float isStar;

        uniform float minSize;
        uniform float maxSize;

        varying vec4 vColor;

        void main(void) {
          vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewPosition;

          gl_PointSize = min(max(pow(15000.0 \/ gl_Position.z, 2.1), minSize * isStar), maxSize) * 1.0;
          vColor = color;
        }
      `
    }, {
      'name': 'dot-vertex-sun.glsl',
      'code': 'attribute vec3 aPos;\nattribute vec4 aColor;\n\nuniform mat4 uCamMatrix;\nuniform mat4 uMvMatrix;\nuniform mat4 uPMatrix;\n\nvarying vec4 vColor;\n\nvoid main(void) {\n \/\/ gl_PointSize = 16.0;\n  vec4 position = uPMatrix * uCamMatrix *  uMvMatrix * vec4(aPos, 1.0);\n  gl_PointSize = min(max(320000.0 \/ position.w, 7.5), 12.0) * 1.0;\n  gl_Position = position;\n  vColor = aColor;\n}\n'
    }, {
      'name': 'pick-fragment.glsl',
      'code': 'precision mediump float;\n\nvarying vec3 vColor;\n\nvoid main(void) {\n  gl_FragColor = vec4(vColor, 1.0);\n}'
    }, {
      'name': 'pick-vertex.glsl',
      'code': 'attribute vec3 aPos;\nattribute vec3 aColor;\nattribute float aPickable;\n\nuniform mat4 uCamMatrix;\nuniform mat4 uMvMatrix;\nuniform mat4 uPMatrix;\n\nvarying vec3 vColor;\n\nvoid main(void) {\n  float dotSize = 16.0;\n  vec4 position = uPMatrix * uCamMatrix *  uMvMatrix * vec4(aPos, 1.0);\n  gl_Position = position;\n  gl_PointSize = dotSize * aPickable;\n  vColor = aColor * aPickable;\n}'
    }, {
      'name': 'path-fragment.glsl',
      'code': 'precision mediump float;\n\nvarying vec4 vColor;\n\nvoid main(void) {\n  gl_FragColor = vColor;\n}'
    }, {
      'name': 'path-vertex.glsl',
      'code': 'attribute vec3 aPos;\n\nuniform mat4 uCamMatrix;\nuniform mat4 uMvMatrix;\nuniform mat4 uPMatrix;\nuniform vec4 uColor;\n\nvarying vec4 vColor;\n\nvoid main(void) {\n  vec4 position = uPMatrix * uCamMatrix *  uMvMatrix * vec4(aPos, 1.0);\n  gl_Position = position;\n  vColor = uColor;\n}\n'
    }];

  shaderLoader.shaderDataLen = shaderLoader.shaderData.length;


  var i = 0;
  shaderLoader.getShaderCode = function (name) {
    for (i = 0; i < shaderLoader.shaderDataLen; i++) {
      if (shaderLoader.shaderData[i].name === name) {
        return shaderLoader.shaderData[i].code;
      }
    }
    return null;
  };

  window.shaderLoader = shaderLoader;
})();
