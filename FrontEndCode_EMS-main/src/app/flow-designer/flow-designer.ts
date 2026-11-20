import { Component, Inject, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export type FlowNodeType = 'start' | 'action' | 'decision' | 'error' | 'expected';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  title: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nextIds: string[];
}

export interface FlowDiagramResult {
  imageBlob: Blob;
  imageDataUrl: string;
  flowJson: string;
  stepsText: string;
  nodeCount: number;
}

export interface FlowDesignerData {
  existingFlowJson?: string;
  title?: string;
}

@Component({
  selector: 'app-flow-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './flow-designer.html',
  styleUrls: ['./flow-designer.css']
})
export class FlowDesigner implements OnInit {
  @ViewChild('exportCanvas', { static: false }) exportCanvas!: ElementRef<HTMLCanvasElement>;

  nodes: FlowNode[] = [];
  selectedNodeId: string | null = null;
  connectingFromId: string | null = null;

  // Dragging state
  draggingNodeId: string | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  readonly canvasWidth = 1200;
  readonly canvasHeight = 720;
  private nodeCounter = 1;

  constructor(
    private dialogRef: MatDialogRef<FlowDesigner, FlowDiagramResult>,
    @Inject(MAT_DIALOG_DATA) public data: FlowDesignerData | null
  ) {}

  ngOnInit(): void {
    if (this.data?.existingFlowJson) {
      try {
        const parsed = JSON.parse(this.data.existingFlowJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.nodes = parsed;
          this.nodeCounter = this.nodes.length + 1;
          return;
        }
      } catch (e) {
        console.warn('Could not parse existing flow diagram JSON, loading default template.');
      }
    }
    this.loadBugTemplate();
  }

  /* ---------- Node Creation & Management ---------- */

  addNode(type: FlowNodeType, customTitle?: string, customDesc?: string, x?: number, y?: number): FlowNode {
    const id = 'step_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const count = this.nodeCounter++;

    let defaultTitle = '';
    let defaultDesc = '';

    switch (type) {
      case 'start':
        defaultTitle = `Step ${count}: Open Application`;
        defaultDesc = 'Navigate to the target screen / page';
        break;
      case 'action':
        defaultTitle = `Step ${count}: User Action`;
        defaultDesc = 'Click button, enter input, or trigger action';
        break;
      case 'decision':
        defaultTitle = `Step ${count}: Condition / Check`;
        defaultDesc = 'Verify system condition or input validation';
        break;
      case 'error':
        defaultTitle = `Step ${count}: Bug / Failure Occurs`;
        defaultDesc = 'System throws error, freezes, or fails';
        break;
      case 'expected':
        defaultTitle = `Step ${count}: Expected Outcome`;
        defaultDesc = 'What the system should have done instead';
        break;
    }

    const posX = x !== undefined ? x : 60 + ((this.nodes.length % 4) * 260);
    const posY = y !== undefined ? y : 80 + (Math.floor(this.nodes.length / 4) * 190);

    const newNode: FlowNode = {
      id,
      type,
      title: customTitle || defaultTitle,
      description: customDesc || defaultDesc,
      x: Math.min(Math.max(20, posX), this.canvasWidth - 240),
      y: Math.min(Math.max(20, posY), this.canvasHeight - 160),
      width: 220,
      height: 140,
      nextIds: []
    };

    this.nodes.push(newNode);
    this.selectedNodeId = newNode.id;
    return newNode;
  }

  deleteNode(id: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.nodes = this.nodes.filter(n => n.id !== id);
    // Remove connections targeting this node
    this.nodes.forEach(n => {
      n.nextIds = n.nextIds.filter(targetId => targetId !== id);
    });
    if (this.selectedNodeId === id) {
      this.selectedNodeId = null;
    }
    if (this.connectingFromId === id) {
      this.connectingFromId = null;
    }
  }

  selectNode(id: string): void {
    if (this.connectingFromId) {
      if (this.connectingFromId !== id) {
        this.toggleConnection(this.connectingFromId, id);
      }
      this.connectingFromId = null;
      return;
    }
    this.selectedNodeId = id;
  }

  /* ---------- Connection Handling ---------- */

  startConnecting(nodeId: string, event: Event): void {
    event.stopPropagation();
    if (this.connectingFromId === nodeId) {
      this.connectingFromId = null;
    } else {
      this.connectingFromId = nodeId;
    }
  }

  toggleConnection(fromId: string, toId: string): void {
    const fromNode = this.nodes.find(n => n.id === fromId);
    if (!fromNode || fromId === toId) return;

    if (fromNode.nextIds.includes(toId)) {
      fromNode.nextIds = fromNode.nextIds.filter(id => id !== toId);
    } else {
      fromNode.nextIds.push(toId);
    }
  }

  removeConnection(fromId: string, toId: string, event: Event): void {
    event.stopPropagation();
    const fromNode = this.nodes.find(n => n.id === fromId);
    if (fromNode) {
      fromNode.nextIds = fromNode.nextIds.filter(id => id !== toId);
    }
  }

  autoConnectSequential(): void {
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const current = this.nodes[i];
      const next = this.nodes[i + 1];
      if (!current.nextIds.includes(next.id)) {
        current.nextIds.push(next.id);
      }
    }
  }

  autoLayout(): void {
    const spacingX = 250;
    const spacingY = 170;
    const cols = 4;
    this.nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      node.x = 60 + col * spacingX;
      node.y = 60 + row * spacingY;
    });
  }

  loadBugTemplate(): void {
    this.nodes = [];
    this.nodeCounter = 1;

    const n1 = this.addNode('start', 'Step 1: Open Application', 'Navigate to login / target module screen', 60, 60);
    const n2 = this.addNode('action', 'Step 2: Enter Input', 'Type invalid payload / credentials', 320, 60);
    const n3 = this.addNode('action', 'Step 3: Trigger Action', 'Click Submit / Action button', 580, 60);
    const n4 = this.addNode('error', 'Step 4: Bug / Failure', 'Application crashes with 500 or UI freeze', 840, 60);
    const n5 = this.addNode('expected', 'Step 5: Expected Result', 'Form shows inline validation message', 840, 250);

    n1.nextIds = [n2.id];
    n2.nextIds = [n3.id];
    n3.nextIds = [n4.id];
    n4.nextIds = [n5.id];
  }

  clearAll(): void {
    if (confirm('Clear all steps on the diagram?')) {
      this.nodes = [];
      this.nodeCounter = 1;
      this.selectedNodeId = null;
      this.connectingFromId = null;
    }
  }

  /* ---------- Drag & Drop Handlers ---------- */

  onMouseDown(event: MouseEvent, node: FlowNode): void {
    // Only drag with left mouse click on card (not inside text inputs)
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('button')) {
      return;
    }
    this.draggingNodeId = node.id;
    this.dragOffsetX = event.clientX - node.x;
    this.dragOffsetY = event.clientY - node.y;
    this.selectedNodeId = node.id;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.draggingNodeId) return;

    const node = this.nodes.find(n => n.id === this.draggingNodeId);
    if (!node) return;

    let newX = event.clientX - this.dragOffsetX;
    let newY = event.clientY - this.dragOffsetY;

    // Boundaries
    newX = Math.max(10, Math.min(newX, this.canvasWidth - node.width - 10));
    newY = Math.max(10, Math.min(newY, this.canvasHeight - node.height - 10));

    node.x = newX;
    node.y = newY;
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    this.draggingNodeId = null;
  }

  /* ---------- SVG Line Calculations ---------- */

  getConnections(): { fromNode: FlowNode; toNode: FlowNode; path: string; midX: number; midY: number }[] {
    const conns: { fromNode: FlowNode; toNode: FlowNode; path: string; midX: number; midY: number }[] = [];

    for (const fromNode of this.nodes) {
      for (const toId of fromNode.nextIds) {
        const toNode = this.nodes.find(n => n.id === toId);
        if (!toNode) continue;

        // Start point: right side or bottom of fromNode
        // End point: left side or top of toNode
        const fromCenterX = fromNode.x + fromNode.width / 2;
        const fromCenterY = fromNode.y + fromNode.height / 2;
        const toCenterX = toNode.x + toNode.width / 2;
        const toCenterY = toNode.y + toNode.height / 2;

        let startX = fromNode.x + fromNode.width;
        let startY = fromCenterY;
        let endX = toNode.x;
        let endY = toCenterY;

        // If toNode is directly below, route from bottom to top
        if (Math.abs(fromCenterX - toCenterX) < 120 && toNode.y > fromNode.y) {
          startX = fromCenterX;
          startY = fromNode.y + fromNode.height;
          endX = toCenterX;
          endY = toNode.y;
        } else if (toNode.x < fromNode.x) {
          // If toNode is to the left
          startX = fromNode.x;
          startY = fromCenterY;
          endX = toNode.x + toNode.width;
          endY = toCenterY;
        }

        const deltaX = Math.abs(endX - startX) * 0.5;
        const cp1x = startX + (endX > startX ? deltaX : -deltaX);
        const cp1y = startY;
        const cp2x = endX - (endX > startX ? deltaX : -deltaX);
        const cp2y = endY;

        const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        conns.push({ fromNode, toNode, path, midX, midY });
      }
    }

    return conns;
  }

  /* ---------- Image Rasterization & Save ---------- */

  saveAndAttach(): void {
    if (this.nodes.length === 0) {
      alert('Please add at least one step to the flow diagram.');
      return;
    }

    // Generate human-readable reproduction steps
    const stepsText = this.nodes
      .map((node, index) => `${index + 1}. [${this.typeLabel(node.type)}] ${node.title}: ${node.description}`)
      .join('\n');

    const flowJson = JSON.stringify(this.nodes);

    // Render to canvas for high-resolution PNG image
    this.renderDiagramToCanvas().then(({ blob, dataUrl }) => {
      this.dialogRef.close({
        imageBlob: blob,
        imageDataUrl: dataUrl,
        flowJson,
        stepsText,
        nodeCount: this.nodes.length
      });
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  private renderDiagramToCanvas(): Promise<{ blob: Blob; dataUrl: string }> {
    return new Promise((resolve) => {
      // Find bounding box of nodes
      let minX = this.canvasWidth;
      let minY = this.canvasHeight;
      let maxX = 0;
      let maxY = 0;

      for (const node of this.nodes) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      }

      const padding = 50;
      const exportW = Math.max(800, maxX + padding * 2);
      const exportH = Math.max(500, maxY + padding * 2);

      const canvas = document.createElement('canvas');
      canvas.width = exportW;
      canvas.height = exportH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, exportW, exportH);

      // Grid dots
      ctx.fillStyle = '#1e293b';
      for (let x = 20; x < exportW; x += 25) {
        for (let y = 20; y < exportH; y += 25) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Header watermark
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('BUG REPRODUCTION FLOW DIAGRAM', 30, 32);

      // Draw connection lines
      const conns = this.getConnections();
      for (const conn of conns) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();

        // Approximate bezier curve in canvas
        const fromCenterX = conn.fromNode.x + conn.fromNode.width / 2;
        const toCenterX = conn.toNode.x + conn.toNode.width / 2;
        let startX = conn.fromNode.x + conn.fromNode.width;
        let startY = conn.fromNode.y + conn.fromNode.height / 2;
        let endX = conn.toNode.x;
        let endY = conn.toNode.y + conn.toNode.height / 2;

        if (Math.abs(fromCenterX - toCenterX) < 120 && conn.toNode.y > conn.fromNode.y) {
          startX = fromCenterX;
          startY = conn.fromNode.y + conn.fromNode.height;
          endX = toCenterX;
          endY = conn.toNode.y;
        } else if (conn.toNode.x < conn.fromNode.x) {
          startX = conn.fromNode.x;
          startY = conn.fromNode.y + conn.fromNode.height / 2;
          endX = conn.toNode.x + conn.toNode.width;
          endY = conn.toNode.y + conn.toNode.height / 2;
        }

        const deltaX = Math.abs(endX - startX) * 0.5;
        const cp1x = startX + (endX > startX ? deltaX : -deltaX);
        const cp1y = startY;
        const cp2x = endX - (endX > startX ? deltaX : -deltaX);
        const cp2y = endY;

        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.stroke();

        // Arrow head at endX, endY
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        const angle = Math.atan2(endY - cp2y, endX - cp2x);
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 12 * Math.cos(angle - Math.PI / 6), endY - 12 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(endX - 12 * Math.cos(angle + Math.PI / 6), endY - 12 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw node cards
      for (const node of this.nodes) {
        this.drawNodeCard(ctx, node);
      }

      const dataUrl = canvas.toDataURL('image/png');
      canvas.toBlob((blob) => {
        resolve({ blob: blob || new Blob(), dataUrl });
      }, 'image/png');
    });
  }

  private drawNodeCard(ctx: CanvasRenderingContext2D, node: FlowNode): void {
    const { x, y, width, height, type } = node;
    const radius = 12;

    // Node background
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = this.typeBorderColor(type);
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Node header band
    ctx.save();
    ctx.fillStyle = this.typeHeaderColor(type);
    ctx.beginPath();
    ctx.moveTo(x + 1, y + radius);
    ctx.quadraticCurveTo(x + 1, y + 1, x + radius, y + 1);
    ctx.lineTo(x + width - radius, y + 1);
    ctx.quadraticCurveTo(x + width - 1, y + 1, x + width - 1, y + radius);
    ctx.lineTo(x + width - 1, y + 34);
    ctx.lineTo(x + 1, y + 34);
    ctx.closePath();
    ctx.fill();

    // Header label
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.typeLabel(type).toUpperCase(), x + 12, y + 22);
    ctx.restore();

    // Node Title
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f1f5f9';
    this.wrapText(ctx, node.title, x + 12, y + 54, width - 24, 16, 2);

    // Node Description
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    this.wrapText(ctx, node.description, x + 12, y + 92, width - 24, 14, 3);
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
    const words = (text || '').split(' ');
    let line = '';
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
        lineCount++;
        if (lineCount >= maxLines - 1 && n < words.length - 1) {
          ctx.fillText(line.trim() + '…', x, y);
          return;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  typeLabel(type: FlowNodeType): string {
    switch (type) {
      case 'start': return 'Start / Trigger';
      case 'action': return 'User Action';
      case 'decision': return 'Condition';
      case 'error': return 'Bug / Failure';
      case 'expected': return 'Expected Result';
    }
  }

  typeBorderColor(type: FlowNodeType): string {
    switch (type) {
      case 'start': return '#10b981';
      case 'action': return '#0284c7';
      case 'decision': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'expected': return '#8b5cf6';
    }
  }

  typeHeaderColor(type: FlowNodeType): string {
    switch (type) {
      case 'start': return '#059669';
      case 'action': return '#0369a1';
      case 'decision': return '#d97706';
      case 'error': return '#dc2626';
      case 'expected': return '#7c3aed';
    }
  }

  typeIcon(type: FlowNodeType): string {
    switch (type) {
      case 'start': return 'play_circle';
      case 'action': return 'touch_app';
      case 'decision': return 'call_split';
      case 'error': return 'error_outline';
      case 'expected': return 'verified';
    }
  }
}
