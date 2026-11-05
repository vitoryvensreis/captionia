"""Native cross-platform PySide6 interface for Caption IA Desktop."""
from __future__ import annotations

import platform
from pathlib import Path

from PySide6.QtCore import Qt, QThread, Signal, QTimer, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QFrame, QWidget, QLabel, QLineEdit,
    QVBoxLayout, QHBoxLayout, QGridLayout, QPushButton, QComboBox,
    QProgressBar, QFileDialog, QStackedWidget, QMessageBox, QTextEdit,
    QScrollArea, QSizePolicy,
)
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtMultimediaWidgets import QVideoWidget

from .api import CaptionApi
from .pipeline import run_pipeline
from .video import probe_video

SITE = "https://caption.escotilhaprodutora.com"

QSS = """
QWidget { background:#100D15; color:#F9F2FB; font-family:'Segoe UI','Arial'; font-size:13px; }
QFrame#Header { background:#190D24; border-bottom:1px solid #412338; }
QLabel#Brand { font-size:24px; font-weight:900; color:#FFFFFF; letter-spacing:1px; }
QLabel#Eyebrow { font-size:11px; font-weight:700; color:#F187B5; }
QLabel#Hero { font-size:30px; font-weight:800; color:#FFFFFF; }
QLabel#Subtitle { font-size:13px; color:#B4A8BD; }
QLabel#Section { font-size:15px; font-weight:700; color:#F9EBFC; }
QLabel#Muted { color:#B5A6BC; }
QLabel#Tag { color:#FE86BD; border:1px solid #633150; padding:5px 9px; border-radius:10px; }
QFrame#Panel { background:#1C1525; border:1px solid #38263F; border-radius:16px; }
QFrame#Preview { background:#09080D; border:1px solid #3B2A46; border-radius:15px; }
QLineEdit, QTextEdit, QComboBox { background:#120E19; border:1px solid #4B3455; border-radius:10px; color:white; padding:10px 12px; selection-background-color:#C73D83; }
QLineEdit:focus, QTextEdit:focus, QComboBox:focus { border:1px solid #F14C98; }
QComboBox { min-height:20px; }
QComboBox QAbstractItemView { background:#201729; color:#F9EFFA; selection-background-color:#743357; }
QPushButton { border-radius:10px; padding:10px 14px; font-weight:700; background:#35233E; border:1px solid #684767; color:#FFFFFF; }
QPushButton:hover { background:#4E2B55; border-color:#C974AC; }
QPushButton:disabled { background:#29212D; color:#827589; border-color:#413346; }
QPushButton#Primary { color:#FFFFFF; border:0; background:#E23A7D; padding:13px 18px; }
QPushButton#Primary:hover { background:#F5539A; }
QPushButton#Secondary { border:1px solid #644265; background:#21182A; }
QProgressBar { min-height:12px; max-height:12px; background:#34253D; border:0; border-radius:6px; text-align:center; }
QProgressBar::chunk { background:#E83C86; border-radius:6px; }
QScrollArea { border:0; }
QScrollBar:vertical { width:8px; background:#191120; }
QScrollBar::handle:vertical { background:#614064; border-radius:4px; }
"""


def label(text: str, kind: str = "") -> QLabel:
    item = QLabel(text)
    if kind:
        item.setObjectName(kind)
    item.setWordWrap(True)
    return item


def button(text: str, kind: str = "Secondary") -> QPushButton:
    obj = QPushButton(text)
    obj.setObjectName(kind)
    obj.setCursor(Qt.CursorShape.PointingHandCursor)
    return obj


class LoginWorker(QThread):
    done = Signal(object)
    failed = Signal(str)

    def __init__(self, api: CaptionApi, email: str = "", password: str = "", restore=False):
        super().__init__()
        self.api, self.email, self.password, self.reconnect = api, email, password, restore

    def run(self):
        try:
            result = self.api.restore() if self.reconnect else self.api.login(self.email, self.password)
            self.done.emit(result)
        except Exception as exc:
            self.failed.emit(str(exc))


class RenderWorker(QThread):
    stage = Signal(str, int)
    done = Signal(str)
    failed = Signal(str)

    def __init__(self, api, source, output, mode, captions, format_name, objective):
        super().__init__()
        self.api = api
        self.params = (source, output, mode, captions, format_name, objective)

    def run(self):
        try:
            path = run_pipeline(self.params[0], self.params[1], self.api,
                                edit_mode=self.params[2], caption_style=self.params[3],
                                output_format=self.params[4], objective=self.params[5],
                                status=lambda message, percent: self.stage.emit(message, percent))
            self.done.emit(str(path))
        except Exception as exc:
            self.failed.emit(str(exc))


class CaptionDesktopWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.api = CaptionApi()
        self.source: Path | None = None
        self.last_output: Path | None = None
        self.worker: QThread | None = None
        self.setWindowTitle("Caption IA Desktop — Vídeo inteligente")
        self.setMinimumSize(1050, 720)
        self.resize(1240, 790)
        self.setStyleSheet(QSS)
        self.stack = QStackedWidget()
        self.setCentralWidget(self.stack)
        self.login_page = self._login_page()
        self.work_page = self._work_page()
        self.stack.addWidget(self.login_page)
        self.stack.addWidget(self.work_page)
        self.stack.setCurrentWidget(self.login_page)
        QTimer.singleShot(250, self.try_restore)

    def _header(self):
        frame = QFrame()
        frame.setObjectName("Header")
        row = QHBoxLayout(frame)
        row.setContentsMargins(24, 12, 24, 12)
        mark = label("C", "Brand")
        mark.setAlignment(Qt.AlignmentFlag.AlignCenter)
        mark.setFixedSize(45, 45)
        mark.setStyleSheet("QLabel {border:2px solid #FF5B9E; border-radius:13px; color:#FF89C2; font-size:26px; font-weight:900;}")
        row.addWidget(mark)
        row.addSpacing(6)
        row.addWidget(label("CAPTION IA", "Brand"))
        row.addWidget(label("DESKTOP  /  BETA 1.0", "Eyebrow"))
        row.addStretch()
        return frame, row

    def _login_page(self):
        root = QWidget()
        outer = QVBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        header, _ = self._header()
        outer.addWidget(header)
        outer.addStretch()
        center = QHBoxLayout()
        center.addStretch()
        panel = QFrame()
        panel.setObjectName("Panel")
        panel.setFixedWidth(500)
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(32, 35, 32, 30)
        layout.setSpacing(15)
        layout.addWidget(label("CONTA CAPTION IA", "Eyebrow"))
        layout.addWidget(label("Seu estúdio. Sem Premiere.", "Hero"))
        layout.addWidget(label("Entre com a mesma conta do site. Sua chave Groq continua protegida na plataforma.", "Subtitle"))
        self.login_email = QLineEdit()
        self.login_email.setPlaceholderText("Seu e-mail")
        self.login_password = QLineEdit()
        self.login_password.setPlaceholderText("Sua senha")
        self.login_password.setEchoMode(QLineEdit.EchoMode.Password)
        self.login_password.returnPressed.connect(self.login_clicked)
        layout.addWidget(label("E-mail", "Section"))
        layout.addWidget(self.login_email)
        layout.addWidget(label("Senha", "Section"))
        layout.addWidget(self.login_password)
        self.login_btn = button("Entrar no Caption IA  →", "Primary")
        self.login_btn.clicked.connect(self.login_clicked)
        layout.addWidget(self.login_btn)
        self.login_status = label("", "Muted")
        layout.addWidget(self.login_status)
        links = QHBoxLayout()
        for caption, link in [("Criar conta", "/cadastro"), ("Configurar chave Groq", "/minha-conta")]:
            action = button(caption)
            action.clicked.connect(lambda _=False, url=link: QDesktopServices.openUrl(QUrl(SITE + url)))
            links.addWidget(action)
        layout.addLayout(links)
        center.addWidget(panel)
        center.addStretch()
        outer.addLayout(center)
        outer.addStretch()
        outer.addWidget(label("  Caption IA Desktop • edição local, IA pela conta Groq • Windows e macOS", "Subtitle"))
        return root

    def _work_page(self):
        root = QWidget()
        outer = QVBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)
        header, bar = self._header()
        self.account_label = label("", "Tag")
        bar.addWidget(self.account_label)
        self.logout_btn = button("Sair")
        self.logout_btn.clicked.connect(self.logout)
        bar.addWidget(self.logout_btn)
        outer.addWidget(header)
        content = QHBoxLayout()
        content.setContentsMargins(22, 22, 22, 22)
        content.setSpacing(20)
        left_scroller = QScrollArea()
        left_scroller.setWidgetResizable(True)
        left_scroller.setFixedWidth(450)
        inner = QWidget()
        controls = QVBoxLayout(inner)
        controls.setContentsMargins(0, 0, 6, 0)
        controls.setSpacing(13)
        controls.addWidget(label("DO UPLOAD AO VÍDEO PRONTO", "Eyebrow"))
        controls.addWidget(label("Transforme suas gravações.", "Hero"))
        controls.addWidget(label("Carregue um vídeo, a IA trabalha, o Caption IA renderiza.", "Subtitle"))
        controls.addSpacing(4)
        self.pick_btn = button("＋  Importar vídeo", "Primary")
        self.pick_btn.clicked.connect(self.select_video)
        controls.addWidget(self.pick_btn)
        self.file_name = label("Nenhum vídeo selecionado", "Muted")
        self.file_name.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        controls.addWidget(self.file_name)
        controls.addWidget(label("01   MODO DE EDIÇÃO", "Section"))
        self.mode = QComboBox()
        self.mode.addItem("Montagem Inteligente IA — cortes e narrativa", "inteligente")
        self.mode.addItem("Cortes automáticos — remover silêncios", "silencios")
        self.mode.addItem("Somente legendar — manter vídeo inteiro", "completo")
        controls.addWidget(self.mode)
        controls.addWidget(label("02   LEGENDAS", "Section"))
        self.style = QComboBox()
        self.style.addItem("Destaque rosa — palavra ativa", "destaque")
        self.style.addItem("Clássico — branco com contorno", "classico")
        self.style.addItem("Minimalista — texto limpo", "minimalista")
        controls.addWidget(self.style)
        controls.addWidget(label("03   ENQUADRAMENTO FINAL", "Section"))
        self.format = QComboBox()
        self.format.addItem("Manter resolução e proporção originais", "original")
        self.format.addItem("Reels / TikTok — vertical 1080×1920", "vertical")
        self.format.addItem("YouTube — horizontal 1920×1080", "horizontal")
        controls.addWidget(self.format)
        controls.addWidget(label("04   OBJETIVO EDITORIAL (OPCIONAL)", "Section"))
        self.goal = QTextEdit()
        self.goal.setPlaceholderText("Ex.: selecione a melhor versão de cada fala, preserve a abertura e o fechamento. Não remova informações essenciais.")
        self.goal.setFixedHeight(88)
        controls.addWidget(self.goal)
        controls.addWidget(label("05   PASTA DE ENTREGA", "Section"))
        target_row = QHBoxLayout()
        self.destination = QLineEdit(str(Path.home() / "Documents" / "CaptionIA-Desktop"))
        target_btn = button("Escolher…")
        target_btn.clicked.connect(self.select_destination)
        target_row.addWidget(self.destination, 1)
        target_row.addWidget(target_btn)
        controls.addLayout(target_row)
        self.render_btn = button("✦  Processar e renderizar vídeo", "Primary")
        self.render_btn.setEnabled(False)
        self.render_btn.clicked.connect(self.start_render)
        controls.addWidget(self.render_btn)
        self.progress = QProgressBar()
        self.progress.setValue(0)
        self.progress.setTextVisible(False)
        controls.addWidget(self.progress)
        self.current_status = label("Importe um vídeo para começar.", "Muted")
        controls.addWidget(self.current_status)
        controls.addStretch()
        left_scroller.setWidget(inner)
        content.addWidget(left_scroller)

        right_panel = QFrame()
        right_panel.setObjectName("Panel")
        right = QVBoxLayout(right_panel)
        right.setContentsMargins(18, 18, 18, 18)
        right.setSpacing(10)
        preview_header = QHBoxLayout()
        preview_header.addWidget(label("PRÉ-VISUALIZAÇÃO", "Section"))
        preview_header.addStretch()
        preview_header.addWidget(label("ORIGINAL", "Tag"))
        right.addLayout(preview_header)
        video_frame = QFrame()
        video_frame.setObjectName("Preview")
        video_box = QVBoxLayout(video_frame)
        video_box.setContentsMargins(1, 1, 1, 1)
        self.video_widget = QVideoWidget()
        self.video_widget.setMinimumHeight(260)
        self.video_widget.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        video_box.addWidget(self.video_widget)
        self.player = QMediaPlayer(self)
        self.audio_output = QAudioOutput(self)
        self.player.setAudioOutput(self.audio_output)
        self.player.setVideoOutput(self.video_widget)
        right.addWidget(video_frame, 1)
        player_bar = QHBoxLayout()
        self.play_btn = button("▶ Reproduzir")
        self.play_btn.setEnabled(False)
        self.play_btn.clicked.connect(self.toggle_play)
        player_bar.addWidget(self.play_btn)
        player_bar.addStretch()
        self.media_info = label("Escolha um vídeo para visualizar.", "Muted")
        player_bar.addWidget(self.media_info)
        right.addLayout(player_bar)
        right.addSpacing(14)
        right.addWidget(label("SAÍDA FINAL", "Section"))
        right.addWidget(label("✓ MP4 renderizado com cortes e legendas\n✓ Legendas .SRT e .ASS editáveis\n✓ Projeto .captionia.json e lista de cortes\n✓ Timeline .FCPXML experimental para intercâmbio", "Subtitle"))
        self.open_output = button("Abrir pasta do último vídeo exportado")
        self.open_output.clicked.connect(self.open_last_output)
        self.open_output.setEnabled(False)
        right.addWidget(self.open_output)
        content.addWidget(right_panel, 1)
        outer.addLayout(content, 1)
        return root

    def try_restore(self):
        self._start_login(restore=True)

    def login_clicked(self):
        self._start_login(self.login_email.text(), self.login_password.text())

    def _start_login(self, email="", password="", restore=False):
        self.login_btn.setEnabled(False)
        self.login_status.setText("Conectando à plataforma…" if not restore else "Restaurando sessão protegida…")
        worker = LoginWorker(self.api, email, password, restore)
        self.worker = worker
        worker.done.connect(self.login_ok)
        worker.failed.connect(lambda message: self.login_failed(message, restore))
        worker.finished.connect(worker.deleteLater)
        worker.start()

    def login_ok(self, state):
        user = state.get("user") or {}
        groq = state.get("groq") or {}
        self.account_label.setText(f"{user.get('name', 'Conta')}  ·  Groq {groq.get('masked_key') or 'conectada'}")
        self.login_password.clear()
        self.login_btn.setEnabled(True)
        self.stack.setCurrentWidget(self.work_page)

    def login_failed(self, error, was_restore):
        self.login_btn.setEnabled(True)
        self.login_status.setText("" if was_restore else error)

    def logout(self):
        self.api.logout()
        self.stack.setCurrentWidget(self.login_page)
        self.login_status.setText("Sessão encerrada.")

    def select_video(self):
        path, _ = QFileDialog.getOpenFileName(self, "Escolher gravação", str(Path.home()),
                                              "Vídeos (*.mp4 *.mov *.mkv *.webm *.avi *.m4v)")
        if not path:
            return
        try:
            info = probe_video(Path(path))
        except Exception as exc:
            QMessageBox.warning(self, "Vídeo incompatível", str(exc))
            return
        self.source = Path(path)
        self.file_name.setText(str(self.source))
        self.media_info.setText(f"{info.width}×{info.height} · {info.duration/60:.1f} min")
        self.player.setSource(QUrl.fromLocalFile(str(self.source)))
        self.play_btn.setEnabled(True)
        self.render_btn.setEnabled(True)
        self.current_status.setText("Tudo pronto. Clique para processar e renderizar.")
        self.progress.setValue(0)

    def select_destination(self):
        dest = QFileDialog.getExistingDirectory(self, "Pasta de entrega", self.destination.text())
        if dest:
            self.destination.setText(dest)

    def toggle_play(self):
        if self.player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.player.pause()
            self.play_btn.setText("▶ Reproduzir")
        else:
            self.player.play()
            self.play_btn.setText("❚❚ Pausar")

    def start_render(self):
        if not self.source:
            return
        self.render_btn.setEnabled(False)
        self.logout_btn.setEnabled(False)
        self.pick_btn.setEnabled(False)
        self.progress.setValue(1)
        self.current_status.setText("Iniciando…")
        worker = RenderWorker(self.api, self.source, Path(self.destination.text()),
                              self.mode.currentData(), self.style.currentData(),
                              self.format.currentData(), self.goal.toPlainText())
        self.worker = worker
        worker.stage.connect(self.render_stage)
        worker.done.connect(self.render_complete)
        worker.failed.connect(self.render_failed)
        worker.finished.connect(worker.deleteLater)
        worker.start()

    def render_stage(self, title, percent):
        self.current_status.setText(title)
        self.progress.setValue(percent)

    def _render_unlock(self):
        self.render_btn.setEnabled(True)
        self.logout_btn.setEnabled(True)
        self.pick_btn.setEnabled(True)

    def render_complete(self, path):
        self._render_unlock()
        self.last_output = Path(path)
        self.progress.setValue(100)
        self.current_status.setText("Vídeo final pronto! MP4 + projeto exportados.")
        self.open_output.setEnabled(True)
        QMessageBox.information(self, "Caption IA Desktop", "Vídeo renderizado com sucesso!\n\n" + path)

    def render_failed(self, error):
        self._render_unlock()
        self.current_status.setText("Processamento interrompido. Confira a mensagem de erro.")
        QMessageBox.critical(self, "Não foi possível renderizar", error[:2200])

    def open_last_output(self):
        if self.last_output:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(self.last_output.parent)))

    def closeEvent(self, event):
        if self.worker and self.worker.isRunning():
            event.ignore()
            QMessageBox.information(self, "Processamento em andamento", "Conclua a tarefa antes de fechar o aplicativo.")
            return
        self.player.stop()
        event.accept()


def main():
    app = QApplication([])
    app.setApplicationName("Caption IA Desktop")
    app.setOrganizationName("CaptionIA")
    window = CaptionDesktopWindow()
    window.show()
    return app.exec()