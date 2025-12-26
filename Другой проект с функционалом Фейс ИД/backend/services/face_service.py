import face_recognition
import cv2
import numpy as np
from PIL import Image
import os

class FaceRecognitionService:
    """Сервис для распознавания лиц"""
    
    def __init__(self):
        self.known_encodings = []
        self.known_student_ids = []
    
    def extract_face_encoding(self, image_path):
        """
        Извлечь face encoding из фотографии
        Returns: encoding или None если лицо не найдено
        """
        try:
            image = face_recognition.load_image_file(image_path)
            encodings = face_recognition.face_encodings(image)
            
            if len(encodings) > 0:
                return encodings[0]
            else:
                return None
        except Exception as e:
            print(f"Ошибка при извлечении encoding: {e}")
            return None
    
    def load_student_encodings(self, students):
        """
        Загрузить все encodings учеников в память
        students: список объектов Student из БД
        """
        self.known_encodings = []
        self.known_student_ids = []
        
        for student in students:
            encoding = student.get_face_encoding()
            if encoding is not None:
                self.known_encodings.append(np.array(encoding))
                self.known_student_ids.append(student.id)
        
        print(f"Загружено {len(self.known_encodings)} encodings учеников")
    
    def recognize_face_from_frame(self, frame):
        """
        Распознать лицо из видеокадра
        frame: numpy array (BGR from OpenCV)
        Returns: student_id или None
        """
        if len(self.known_encodings) == 0:
            return None
        
        # Конвертация BGR -> RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Найти все лица в кадре
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        for encoding in face_encodings:
            # Сравнить с известными encodings
            matches = face_recognition.compare_faces(self.known_encodings, encoding, tolerance=0.6)
            face_distances = face_recognition.face_distance(self.known_encodings, encoding)
            
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                
                if matches[best_match_index]:
                    return self.known_student_ids[best_match_index]
        
        return None
    
    def recognize_multiple_faces_from_frame(self, frame):
        """
        Распознать несколько лиц из видеокадра
        frame: numpy array (BGR from OpenCV)
        Returns: список словарей с информацией о распознанных учениках
        """
        if len(self.known_encodings) == 0:
            return []
        
        # Конвертация BGR -> RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Найти все лица в кадре
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        recognized_students = []
        
        for encoding, location in zip(face_encodings, face_locations):
            # Сравнить с известными encodings
            matches = face_recognition.compare_faces(self.known_encodings, encoding, tolerance=0.6)
            face_distances = face_recognition.face_distance(self.known_encodings, encoding)
            
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                
                if matches[best_match_index]:
                    student_id = self.known_student_ids[best_match_index]
                    recognized_students.append({
                        'student_id': student_id,
                        'location': location  # (top, right, bottom, left)
                    })
        
        return recognized_students
    
    def recognize_face_from_image(self, image_path):
        """
        Распознать лицо из файла изображения
        Returns: student_id или None
        """
        try:
            frame = cv2.imread(image_path)
            if frame is None:
                return None
            return self.recognize_face_from_frame(frame)
        except Exception as e:
            print(f"Ошибка при распознавании: {e}")
            return None
    
    def recognize_multiple_faces_from_image(self, image_path):
        """
        Распознать несколько лиц из файла изображения
        Returns: список student_id
        """
        try:
            frame = cv2.imread(image_path)
            if frame is None:
                return []
            return self.recognize_multiple_faces_from_frame(frame)
        except Exception as e:
            print(f"Ошибка при распознавании: {e}")
            return []
    
    def save_student_photo(self, photo_file, student_id):
        """
        Сохранить фото ученика
        Returns: путь к сохранённому файлу (с прямыми слэшами для URL)
        """
        upload_dir = "frontend/static/uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Убрать пробелы и небезопасные символы из имени файла
        safe_filename = photo_file.filename.replace(' ', '_').replace('%', '')
        filename = f"student_{student_id}_{safe_filename}"
        filepath = os.path.join(upload_dir, filename)
        photo_file.save(filepath)
        
        # Вернуть путь с прямыми слэшами для URL
        return filepath.replace('\\', '/')
