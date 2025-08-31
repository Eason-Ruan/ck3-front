class FloatingWindow {
    constructor(options = {}) {
        // 配置选项
        this.options = {
            title: options.title || 'floating window',
            content: options.content || '<p>This is the content of the floating window</p>',
            width: options.width || 320,
            height: options.height || 'auto',
            x: options.x || null,
            y: options.y || null,
            collapsible: options.collapsible !== false,
            draggable: options.draggable !== false,
            className: options.className || '',
            // inline 渲染支持
            inline: options.inline === true,
            mountContainer: options.mountContainer || null,
            // 聊天配置
            apiEndpoint: options.apiEndpoint || '/api/chat',
            apiMethod: options.apiMethod || 'POST',
            onMessageSend: options.onMessageSend || null,
            onMessageReceive: options.onMessageReceive || null,
            onError: options.onError || null,
            ...options
        };
        
        this.isCollapsed = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        this.createElement();
        this.init();
    }
    
    createElement() {
  
        this.element = document.createElement('div');
        this.element.className = `floating-window ${this.options.className}`;
        if (this.options.inline) {
            this.element.classList.add('inline');
        }
        
        // 浮窗结构
        this.element.innerHTML = `
            <div class="floating-window-header">
                <button class="menu-btn" title="Menu">
                    <span class="menu-icon">☰</span>
                </button>
                <div class="floating-window-title">${this.options.title}</div>
                ${this.options.collapsible ? `
                    <button class="collapse-btn" title="collapse/expand">
                        <span class="collapse-icon">−</span>
                    </button>
                ` : ''}
            </div>
            <div class="floating-window-content">
                <div class="floating-window-sidebar">
                    <div class="sidebar-header">
                        <h4>Menu</h4>
                        <button class="close-sidebar-btn" title="close">&times;</button>
                    </div>
                    <div class="sidebar-content">
                        <div class="new-conversation-btn" id="newConversationBtn">
                            <div class="new-conversation-content">
                                <span class="svg-icon svg-icon-new-chat"></span>
                                <span>New Chat</span>
                            </div>
                        </div>
                        <div class="history-toggle" id="historyToggle">
                            <div class="history-toggle-content">
                                <span class="flex-center-gap">
                                    <span class="svg-icon svg-icon-history"></span>
                                    <span>History</span>
                                </span>
                                <span class="svg-icon svg-icon-history-arrow history-arrow"></span>
                            </div>
                        </div>
                        <div class="conversation-list" id="conversationList">
                            <div id="conversation-1" class="conversation-item">
                                <span class="flex-between">
                                    <span>Conversation 1</span>
                                    <button class="conversation-menu-btn">
                                        <span class="three-dots"></span>
                                    </button>
                                </span>
                            </div>
                        </div>
                        <div class="sidebar-menu-bottom">
                            <div id="menu-setting" class="menu-item-bottom">
                                <span class="flex-center-gap">
                                    <span class="svg-icon svg-icon-settings"></span>
                                    <span>Setting</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="right-panel">
                    <div class="panel-header">
                        <h4 class="panel-title">details</h4>
                        <button class="close-panel-btn" title="close">&times;</button>
                    </div>
                    <div class="panel-content">
                        <div id="setting-content" class="panel-page">
                            <h5>settings</h5>
                            <p>coming...</p>
                        </div>
                        <div id="history-content" class="panel-page">
                            <h5>history</h5>
                            <p>coming...</p>
                        </div>
                    </div>
                </div>
                <!-- Conversation Menu Popup -->
                <div class="conversation-menu-popup" id="conversationMenuPopup">
                    <div class="menu-popup-item" data-action="edit">
                        <span class="svg-icon svg-icon-edit"></span>
                        <span>Edit Title</span>
                    </div>
                    <div class="menu-popup-item" data-action="delete">
                        <span class="svg-icon svg-icon-delete"></span>
                        <span>Delete</span>
                    </div>
                    <div class="menu-popup-item" data-action="export">
                        <span class="svg-icon svg-icon-export"></span>
                        <span>Export</span>
                    </div>
                </div>
                ${typeof this.options.content === 'string' ? this.options.content : ''}
            </div>
        `;
        
        
        this.header = this.element.querySelector('.floating-window-header');
        this.content = this.element.querySelector('.floating-window-content');
        this.collapseBtn = this.element.querySelector('.collapse-btn');
        this.menuBtn = this.element.querySelector('.menu-btn');
        this.sidebar = this.element.querySelector('.floating-window-sidebar');
        this.closeSidebarBtn = this.element.querySelector('.close-sidebar-btn');
        this.rightPanel = this.element.querySelector('.right-panel');
        this.closePanelBtn = this.element.querySelector('.close-panel-btn');
        this.panelTitle = this.element.querySelector('.panel-title');
        
        // 初始样式
        if (this.options.width !== 320 && this.options.width !== undefined && this.options.width !== null) {
            if (typeof this.options.width === 'number') {
                this.element.style.width = this.options.width + 'px';
            } else if (typeof this.options.width === 'string') {
                this.element.style.width = this.options.width;
            }
        }
        if (this.options.height && this.options.height !== 'auto') {
            if (typeof this.options.height === 'number') {
                this.element.style.height = this.options.height + 'px';
            } else if (typeof this.options.height === 'string') {
                this.element.style.height = this.options.height;
            }
        }
        
        // 初始位置
        if (this.options.x !== null && this.options.y !== null) {
            this.setPosition(this.options.x, this.options.y);
        }
        
        
        if (typeof this.options.content !== 'string' && this.options.content) {
            this.content.innerHTML = '';
            this.content.appendChild(this.options.content);
        }
        
        let mountTarget = document.body;
        if (this.options.mountContainer) {
            mountTarget = typeof this.options.mountContainer === 'string'
                ? document.querySelector(this.options.mountContainer)
                : this.options.mountContainer;
            if (!mountTarget) {
                // fallback
                mountTarget = document.body;
            }
        }
        mountTarget.appendChild(this.element);
    }
    
    init() {
    
        // inline 模式默认禁用拖拽
        if (this.options.draggable && !this.options.inline) {
            this.bindDragEvents();
        }
        
        if (this.options.collapsible) {
            this.bindCollapseEvents();
        }
        
        
        this.bindMenuEvents();
        
        this.bindChatEvents();
        
        this.show();
    }
    
    bindChatEvents() {

        setTimeout(() => {
            const chatInput = this.element.querySelector('#chatInput');
            const sendButton = this.element.querySelector('#sendButton');
            const chatMessages = this.element.querySelector('#chatMessages');
            
            if (chatInput && sendButton && chatMessages) {
                // send
                sendButton.addEventListener('click', () => {
                    this.sendMessage(chatInput, chatMessages);
                });
                
                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.sendMessage(chatInput, chatMessages);
                    }
                });
            }
        }, 100);
    }
    
    sendMessage(inputElement, messagesContainer) {
        const message = inputElement.value.trim();
        if (!message) return;
        
        this.addMessage(messagesContainer, message, 'user');
        
        inputElement.value = '';
        
        this.showTypingIndicator(messagesContainer);
        
        // 调用发送消息接口
        this.sendToServer(message, messagesContainer);
    }
    
    // 发送消息到服务器的接口
    async sendToServer(message, messagesContainer) {
        try {
            // 调用发送回调
            if (this.options.onMessageSend) {
                const result = await this.options.onMessageSend(message);
                if (result) {
                    this.removeTypingIndicator(messagesContainer);
                    this.addMessage(messagesContainer, result, 'assistant');
                    return;
                }
            }
            
            // API端点发送请求
            const response = await fetch(this.options.apiEndpoint, {
                method: this.options.apiMethod,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            this.removeTypingIndicator(messagesContainer);
            
            // 调用接收回调
            if (this.options.onMessageReceive) {
                const processedReply = this.options.onMessageReceive(data);
                if (processedReply) {
                    this.addMessage(messagesContainer, processedReply, 'assistant');
                    return;
                }
            }
            
            // 服务器回复
            if (data.reply) {
                this.addMessage(messagesContainer, data.reply, 'assistant');
            } else if (data.message) {
                this.addMessage(messagesContainer, data.message, 'assistant');
            }
            
        } catch (error) {
            console.error('fail to send message:', error);

            this.removeTypingIndicator(messagesContainer);

            // 调用错误回调
            if (this.options.onError) {
                const errorMessage = this.options.onError(error);
                if (errorMessage) {
                    this.addMessage(messagesContainer, errorMessage, 'error');
                    return;
                }
            }
            
            // 默认错误消息
            this.addMessage(messagesContainer, 'fail to connect to server', 'error');
        }
    }
    
    //输入
    showTypingIndicator(container) {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message typing-message';
        typingDiv.id = 'typingIndicator';
        
        const typingContent = document.createElement('div');
        typingContent.className = 'message-content typing-content assistant-typing';
        typingContent.innerHTML = '<span class="typing-dots">typing...<span class="dots">...</span></span>';
        
        typingDiv.appendChild(typingContent);
        container.appendChild(typingDiv);
        

        container.scrollTop = container.scrollHeight;
    }
    
    removeTypingIndicator(container) {
        const typingIndicator = container.querySelector('#typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    addMessage(container, content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = `message-content ${type}-label`;
        messageContent.textContent = content;
        
        messageDiv.appendChild(messageContent);
        container.appendChild(messageDiv);

        container.scrollTop = container.scrollHeight;
    }
    
    bindCollapseEvents() {
        if (this.collapseBtn) {
            this.collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCollapse();
            });
        }
    }
    
    bindMenuEvents() {
        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSidebar();
            });
        }
        
        if (this.closeSidebarBtn) {
            this.closeSidebarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeSidebar();
            });
        }
        
        if (this.closePanelBtn) {
            this.closePanelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeRightPanel();
            });
        }
        
        //setting
        const settingBtn = this.element.querySelector('#menu-setting');
        if (settingBtn) {
            settingBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showRightPanel('setting');
            });
        }
        
        const menuItems = this.element.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = item.id.replace('menu-', '');
                this.showRightPanel(itemId);
            });
        });
        
        // New Conversation
        const newConversationBtn = this.element.querySelector('#newConversationBtn');
        if (newConversationBtn) {
            newConversationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('new chat');
                // new chat 还没写
            });
        }
        
        // History
        const historyToggle = this.element.querySelector('#historyToggle');
        const conversationList = this.element.querySelector('#conversationList');
        if (historyToggle && conversationList) {
            historyToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                historyToggle.classList.toggle('expanded');
                conversationList.classList.toggle('expanded');
            });
        }
        
        // conversation
        const conversationItems = this.element.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            const titleWrapper = item.querySelector('span span:first-child');
            if (titleWrapper) {
                titleWrapper.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('choose chat:', titleWrapper.textContent);
                    // choose chat逻辑还没写
                });
            }
        });

        // conversation menu
        const conversationMenuBtns = this.element.querySelectorAll('.conversation-menu-btn');
        const menuPopup = this.element.querySelector('#conversationMenuPopup');
        let currentConversationItem = null;

        conversationMenuBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentConversationItem = btn.closest('.conversation-item');
                
                if (menuPopup.classList.contains('visible')) {
                    this.hideConversationMenu(menuPopup);
                } else {
                    this.showConversationMenu(btn, menuPopup);
                }
            });
        });

        if (menuPopup) {
            const menuItems = menuPopup.querySelectorAll('.menu-popup-item');
            menuItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = item.dataset.action;
                    this.handleConversationMenuAction(action, currentConversationItem);
                    this.hideConversationMenu(menuPopup);
                });
            });
        }

        document.addEventListener('click', () => {
            if (menuPopup) {
                this.hideConversationMenu(menuPopup);
            }
        });
        
        if (this.content) {
            this.content.addEventListener('click', (e) => {
                if (!this.sidebar.contains(e.target) && 
                    !this.menuBtn.contains(e.target) && 
                    !this.rightPanel.contains(e.target)) {
                    this.closeSidebar();
                }
            });
        }
    }
    
    bindDragEvents() {
        // drag
        this.header.addEventListener('mousedown', (e) => {
            this.startDrag(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            this.drag(e);
        });
        
        document.addEventListener('mouseup', () => {
            this.endDrag();
        });
        
        this.header.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
        
        this.header.addEventListener('touchstart', (e) => {
            this.startDrag(e.touches[0]);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                this.drag(e.touches[0]);
            }
        });
        
        document.addEventListener('touchend', () => {
            this.endDrag();
        });
    }
    
    // show 
    show() {
        this.element.classList.remove('display-none');
        this.element.classList.add('show', 'display-block');
    }
    
    // hide
    hide() {
        this.element.classList.add('display-none');
        this.element.classList.remove('show', 'display-block');
    }
    
    // switch
    toggle() {
        if (this.element.classList.contains('display-none')) {
            this.show();
        } else {
            this.hide();
        }
    }

    // collapse
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    collapse() {
        this.element.classList.add('collapsed');
        this.isCollapsed = true;
    }
    
    // expand
    expand() {
        this.element.classList.remove('collapsed');
        this.isCollapsed = false;
    }

    // sidebar menu
    toggleSidebar() {
        if (this.element.classList.contains('sidebar-open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }
    
    openSidebar() {
        this.element.classList.add('sidebar-open');
        if (this.menuBtn) {
            this.menuBtn.classList.add('active');
        }
    }

    closeSidebar() {
        this.element.classList.remove('sidebar-open');
        if (this.menuBtn) {
            this.menuBtn.classList.remove('active');
        }
        this.closeRightPanel();
    }
    
    // conversation memu
    showConversationMenu(button, popup) {
        const floatingWindow = this.element;
        const windowRect = floatingWindow.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        
        const relativeTop = buttonRect.top - windowRect.top;
        const relativeLeft = buttonRect.left - windowRect.left;
        
        const isSidebarOpen = floatingWindow.classList.contains('sidebar-open');
        
        let left, top;
        
        if (isSidebarOpen) {

            const sidebarWidth = Math.min(floatingWindow.offsetWidth * 0.33333, 140);
            left = sidebarWidth;
        } else {
            left = 0;
        }
        
        top = relativeTop;
        
        const popupWidth = 120;
        if (left + popupWidth > floatingWindow.offsetWidth) {
            left = floatingWindow.offsetWidth - popupWidth - 10;
        }
        
        if (top < 0) {
            top = 0;
        }
        if (top + 90 > floatingWindow.offsetHeight) {
            top = floatingWindow.offsetHeight - 90 - 10;
        }
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        popup.classList.remove('display-none', 'hidden');
        popup.classList.add('display-block', 'visible');
    }

    hideConversationMenu(popup) {
        popup.classList.add('display-none', 'hidden');
        popup.classList.remove('display-block', 'visible');
    }

    handleConversationMenuAction(action, conversationItem) {
        const titleElement = conversationItem.querySelector('span span:first-child');
        const conversationName = titleElement ? titleElement.textContent : 'Unknown';
        
        switch (action) {
            case 'delete':
                this.showConfirmDialog(
                    'Delete Conversation',
                    `Are you sure you want to delete the conversation "${conversationName}"?`,
                    () => {
                        conversationItem.remove();
                        console.log('Delete conversation:', conversationName);
                    },
                    null,
                    'dialog-delete'
                );
                break;
            case 'edit':
                this.showInputDialog(
                    'Edit Title',
                    'Please enter a new title:',
                    conversationName,
                    (newTitle) => {
                        if (newTitle && newTitle.trim()) {
                            titleElement.textContent = newTitle.trim();
                            console.log('Edit title:', conversationName, '=>', newTitle.trim());
                        }
                    },
                    null,
                    'dialog-edit-title'
                );
                break;
            case 'export':
                console.log('Export:', conversationName);
                this.showInfoDialog(
                    'Export',
                    `Export "${conversationName}" coming soon...`,
                    null,
                    'dialog-export'
                );
                break;
        }
    }
    
    // setting page
    showRightPanel(contentType) {
        const allPanels = this.element.querySelectorAll('.panel-page');
        allPanels.forEach(panel => panel.classList.add('display-none'));
        
        const targetPanel = this.element.querySelector(`#${contentType}-content`);
        if (targetPanel) {
            targetPanel.classList.remove('display-none');
            targetPanel.classList.add('display-block');
        }
        
        const titles = {
            'setting': 'setting'
        };
        if (this.panelTitle) {
            this.panelTitle.textContent = titles[contentType] || 'details';
        }
        
        this.element.classList.add('panel-open');
    }
    
    closeRightPanel() {
        this.element.classList.remove('panel-open');
        
        const allPanels = this.element.querySelectorAll('.panel-page');
        allPanels.forEach(panel => panel.classList.add('display-none'));
    }
    
    // drag
    startDrag(e) {
        this.isDragging = true;
        this.element.classList.add('dragging');
        
        const rect = this.element.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        document.body.classList.add('dragging');
    }
    

    drag(e) {
        if (!this.isDragging) return;
        
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        const maxX = window.innerWidth - this.element.offsetWidth;
        const maxY = window.innerHeight - this.element.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));
        
        this.element.style.left = constrainedX + 'px';
        this.element.style.top = constrainedY + 'px';
        this.element.style.right = 'auto'; 
    }
    
    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.element.classList.remove('dragging');

        document.body.classList.remove('dragging');
    }

    setPosition(x, y) {
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
        this.element.style.right = 'auto';
    }

    setSize(width, height) {
        this.element.style.width = width + 'px';
        if (height && height !== 'auto') {
            this.element.style.height = height + 'px';
        }
    }
    

    setTitle(title) {
        const titleElement = this.element.querySelector('.floating-window-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }
    
    setContent(content) {
        if (this.content) {
            if (typeof content === 'string') {
                this.content.innerHTML = content;
            } else {
                this.content.innerHTML = '';
                this.content.appendChild(content);
            }
        }
    }
    
    getPosition() {
        const rect = this.element.getBoundingClientRect();
        return {
            x: rect.left,
            y: rect.top
        };
    }
    
    getSize() {
        return {
            width: this.element.offsetWidth,
            height: this.element.offsetHeight
        };
    }
    
    // chatting
    createDialogTemplate(type, message, inputValue = '') {
        const templates = {
            confirm: `
                <div class="custom-dialog-container">
                    <div class="custom-dialog-message">${message}</div>
                    <div class="custom-dialog-buttons">
                        <button class="custom-dialog-btn confirm" data-action="confirm">confirm</button>
                        <button class="custom-dialog-btn cancel" data-action="cancel">cancel</button>
                    </div>
                </div>
            `,
            input: `
                <div class="custom-dialog-container input-dialog">
                    <div class="custom-dialog-message input-message">${message}</div>
                    <input type="text" class="custom-dialog-input" value="${inputValue}">
                    <div class="custom-dialog-buttons">
                        <button class="custom-dialog-btn confirm" data-action="confirm">confirm</button>
                        <button class="custom-dialog-btn cancel" data-action="cancel">cancel</button>
                    </div>
                </div>
            `,
            info: `
                <div class="info-dialog-container">
                    <div class="info-dialog-message">${message}</div>
                    <button class="info-dialog-btn" data-action="confirm">confirm</button>
                </div>
            `
        };
        return templates[type] || templates.info;
    }

    bindDialogEvents(dialog, type, onConfirm, onCancel) {
        const buttons = dialog.element.querySelectorAll('[data-action]');
        const input = dialog.element.querySelector('.custom-dialog-input');
        
        if (input) {
            input.focus();
            input.select();
        }
        
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                dialog.destroy();
                
                if (action === 'confirm' && onConfirm) {
                    const value = input ? input.value : null;
                    onConfirm(value);
                } else if (action === 'cancel' && onCancel) {
                    onCancel();
                }
            });
        });
        
        if (input && type === 'input') {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    dialog.destroy();
                    if (onConfirm) onConfirm(input.value);
                }
            });
        }
    }

    showConfirmDialog(title, message, onConfirm, onCancel, className = 'dialog-confirm') {
        const dialog = this.showCustomDialog({
            title: title,
            content: this.createDialogTemplate('confirm', message),
            className: className,
            hideMenuButton: true
        });
        
        this.bindDialogEvents(dialog, 'confirm', onConfirm, onCancel);
    }

    showInputDialog(title, message, defaultValue, onConfirm, onCancel, className = 'dialog-input') {
        const dialog = this.showCustomDialog({
            title: title,
            content: this.createDialogTemplate('input', message, defaultValue || ''),
            className: className,
            hideMenuButton: true
        });
        
        this.bindDialogEvents(dialog, 'input', onConfirm, onCancel);
    }

    showInfoDialog(title, message, onClose, className = 'dialog-info') {
        const dialog = this.showCustomDialog({
            title: title,
            content: this.createDialogTemplate('info', message),
            className: className,
            hideMenuButton: true
        });
        
        this.bindDialogEvents(dialog, 'info', onClose);
    }    

    showCustomDialog(options) {
        const dialog = new FloatingWindow({
            title: options.title,
            content: options.content,
            x: (window.innerWidth - 300) / 2, 
            y: (window.innerHeight - 200) / 2,
            collapsible: false,
            draggable: true,
            className: options.className || ''
        });
        
        setTimeout(() => {
            const rect = dialog.element.getBoundingClientRect();
            const centerX = (window.innerWidth - rect.width) / 2;
            const centerY = (window.innerHeight - rect.height) / 2;
            dialog.element.style.left = centerX + 'px';
            dialog.element.style.top = centerY + 'px';
        }, 0);
        
        if (options.hideMenuButton) {
            const menuBtn = dialog.element.querySelector('.menu-btn');
            if (menuBtn) {
                menuBtn.classList.add('display-none');
            }

            const title = dialog.element.querySelector('.floating-window-title');
            if (title) {
                title.classList.add('text-align-left', 'padding-left-12');
            }
            
            const header = dialog.element.querySelector('.floating-window-header');
            if (header) {
        
                header.classList.add('position-relative');
                
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '×';
                closeBtn.className = 'custom-dialog-close-btn';
                
                closeBtn.addEventListener('click', () => {
                    dialog.destroy();
                });
                
                header.appendChild(closeBtn);
            }
        }
        
        if (options.onRender) {
            options.onRender(dialog);
        }
        
        return dialog;
    }


    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// 备用静态
FloatingWindow.create = function(options) {
    return new FloatingWindow(options);
};


FloatingWindow.message = function(message, type = 'info', duration = 3000) {
    const content = `
        <div class="message-container">
            <div class="message-indicator message-indicator-${type}"></div>
            <div class="message-content-wrapper">
                <div class="message-title">${type}</div>
                <div class="message-text">${message}</div>
            </div>
        </div>
    `;
    
    const floatingWindow = new FloatingWindow({
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} message`,
        content: content,
        width: 300,
        x: window.innerWidth - 350,
        y: 50,
        collapsible: false,
        className: `message-${type}`
    });
    
    if (duration > 0) {
        setTimeout(() => {
            floatingWindow.destroy();
        }, duration);
    }
    
    return floatingWindow;
};


FloatingWindow.confirm = function(message, onConfirm, onCancel) {
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="confirm-dialog-message">${message}</div>
        <div class="confirm-dialog-buttons">
            <button id="cancelBtn" class="confirm-dialog-btn cancel">cancel</button>
            <button id="confirmBtn" class="confirm-dialog-btn confirm">confirm</button>
        </div>
    `;
    
    const floatingWindow = new FloatingWindow({
        title: 'confirm',
        content: content,
        width: 350,
        x: (window.innerWidth - 350) / 2,
        y: (window.innerHeight - 200) / 2,
        collapsible: false,
        draggable: true
    });
    
    const confirmBtn = content.querySelector('#confirmBtn');
    const cancelBtn = content.querySelector('#cancelBtn');
    
    confirmBtn.addEventListener('click', () => {
        floatingWindow.destroy();
        if (onConfirm) onConfirm();
    });
    
    cancelBtn.addEventListener('click', () => {
        floatingWindow.destroy();
        if (onCancel) onCancel();
    });
    
    return floatingWindow;
};


if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatingWindow;
}


window.FloatingWindow = FloatingWindow;


window.createDemoFloatingWindow = function() {
    const defaultOptions = {
        title: 'CK3 AI assistant',
        content: `
            <div class="chat-container">
                <div class="chat-messages" id="chatMessages">
                    <div class="message assistant-message">
                        <div class="message-content">
                            <strong>CK3 AI assistant:</strong> Please enter your message...
                        </div>
                    </div>
                </div>
                <div class="chat-input-container">
                    <div class="input-wrapper">
                        <input type="text" id="chatInput" placeholder="Please enter your message..." class="chat-input" />
                        <button id="sendButton" class="send-button">send</button>
                    </div>
                </div>
            </div>
        `,
        width: 400,
        x: 100,
        y: 100,
        // API
        apiEndpoint: '/api/chat',
        // 处理send message（在无后端时本地模拟回复，避免404）
        onMessageSend: async function(message) {
            console.log('send:', message);
            await new Promise(r => setTimeout(r, 400));
            return `echo: ${message}`;
        },

        // 处理receive message
        onMessageReceive: function(data) {
            // 可处理服务器返回内容


            //
            console.log('receive:', data);
            return data.reply || data.message; // 返回要显示的内容
        },

        // 错误处理
        onError: function(error) {
            console.error('chat:', error);
            return `connection error: ${error.message}`; // 返回错误消息
        }
    };
    // 允许外部传入覆盖选项：createDemoFloatingWindow(opts)
    const overrides = (arguments && arguments[0]) ? arguments[0] : {};
    return FloatingWindow.create({ ...defaultOptions, ...overrides });
};


// 直接在 index.html 的某个容器内渲染聊天结构（不创建二级浮窗）
window.renderChatInline = function(containerSelector = 'body') {
    const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;

    if (!container) {
        console.error('renderChatInline: container not found:', containerSelector);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-container inline-chat';
    wrapper.innerHTML = `
        <div class="chat-messages" id="chatMessages">
            <div class="message assistant-message">
                <div class="message-content">
                    <strong>CK3 AI assistant:</strong> Please enter your message...
                </div>
            </div>
        </div>
        <div class="chat-input-container">
            <div class="input-wrapper">
                <input type="text" id="chatInput" placeholder="Please enter your message..." class="chat-input" />
                <button id="sendButton" class="send-button">send</button>
            </div>
        </div>
    `;

    container.appendChild(wrapper);

    // 复用 FloatingWindow 的发送逻辑（本地 echo，避免后端依赖）
    const chatInput = wrapper.querySelector('#chatInput');
    const sendButton = wrapper.querySelector('#sendButton');
    const chatMessages = wrapper.querySelector('#chatMessages');

    const addMessage = (content, type) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        const messageContent = document.createElement('div');
        messageContent.className = `message-content ${type}-label`;
        messageContent.textContent = content;
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const showTyping = () => {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message typing-message';
        typingDiv.id = 'typingIndicator';
        const typingContent = document.createElement('div');
        typingContent.className = 'message-content typing-content assistant-typing';
        typingContent.innerHTML = '<span class="typing-dots">typing...<span class="dots">...</span></span>';
        typingDiv.appendChild(typingContent);
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const removeTyping = () => {
        const typing = chatMessages.querySelector('#typingIndicator');
        if (typing) typing.remove();
    };

    const handleSend = async () => {
        const message = chatInput.value.trim();
        if (!message) return;
        addMessage(message, 'user');
        chatInput.value = '';
        showTyping();
        await new Promise(r => setTimeout(r, 400));
        removeTyping();
        addMessage(`echo: ${message} \uD83D\uDCAC`, 'assistant');
    };

    if (sendButton) {
        sendButton.addEventListener('click', handleSend);
    }
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }
};

